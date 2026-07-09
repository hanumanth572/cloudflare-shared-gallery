import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sg_session";

/** Re-issue the cookie when the token is within 7 days of expiry. */
export const RENEW_THRESHOLD_S = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

export function sessionTtlDays(env: Env): number {
  const n = Number.parseInt(env.SESSION_TTL_DAYS, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/* --------------------------------- JWT ---------------------------------- */

export async function mintSessionJwt(secret: string, ttlDays: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("shared")
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(encoder.encode(secret));
}

export interface SessionClaims {
  /** Expiry, seconds since epoch. */
  exp: number;
}

export async function verifySessionJwt(
  secret: string,
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
    });
    if (payload.sub !== "shared" || typeof payload.exp !== "number") return null;
    return { exp: payload.exp };
  } catch {
    return null;
  }
}

/* -------------------------------- cookies ------------------------------- */

/**
 * The Secure attribute is dropped for plain-http origins (local dev via curl
 * and Safari, which both refuse Secure cookies over http). Production is
 * always https, so deployed cookies are always Secure.
 */
export function sessionCookie(token: string, maxAgeS: number, secure: boolean): string {
  return (
    `${SESSION_COOKIE}=${token}; HttpOnly; ${secure ? "Secure; " : ""}` +
    `SameSite=Lax; Path=/; Max-Age=${maxAgeS}`
  );
}

export function clearSessionCookie(secure: boolean): string {
  return sessionCookie("", 0, secure);
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/* --------------------------- password (PBKDF2) --------------------------- */

/**
 * Verifies a password against a `pbkdf2$<iterations>$<saltB64>$<hashB64>`
 * string (SHA-256), using WebCrypto and a constant-time comparison.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[2]);
    expected = fromBase64(parts[3]);
  } catch {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    keyMaterial,
    expected.byteLength * 8,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
