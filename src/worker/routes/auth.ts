import type { Ctx, Router } from "../router";
import { error, json, noContent, readJson } from "../lib/json";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getCookie,
  mintSessionJwt,
  sessionCookie,
  sessionTtlDays,
  verifyPassword,
  verifySessionJwt,
} from "../lib/auth";
import { clearLoginFailures, isThrottled, recordLoginFailure } from "../db/queries";

export function registerAuthRoutes(router: Router): void {
  router.post("/api/auth/login", login);
  router.post("/api/auth/logout", logout);
  router.get("/api/auth/session", session);
}

async function login(ctx: Ctx): Promise<Response> {
  const ip = ctx.req.headers.get("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();

  // D1-backed brute-force throttle: >10 failures per IP in 5 minutes → 429.
  if (await isThrottled(ctx.env.DB, ip, now)) {
    return error("Too many failed attempts. Try again in a few minutes.", 429);
  }

  const body = await readJson<{ password?: unknown }>(ctx.req);
  const password = body?.password;
  if (typeof password !== "string" || password.length === 0) {
    return error("Password is required", 400);
  }

  const ok = await verifyPassword(password, ctx.env.GALLERY_PASSWORD_HASH);
  if (!ok) {
    await recordLoginFailure(ctx.env.DB, ip, now);
    return error("Incorrect password", 401);
  }

  await clearLoginFailures(ctx.env.DB, ip);
  const ttlDays = sessionTtlDays(ctx.env);
  const token = await mintSessionJwt(ctx.env.JWT_SECRET, ttlDays);
  return noContent({
    "Set-Cookie": sessionCookie(token, ttlDays * 24 * 60 * 60, ctx.url.protocol === "https:"),
  });
}

function logout(ctx: Ctx): Response {
  return noContent({ "Set-Cookie": clearSessionCookie(ctx.url.protocol === "https:") });
}

async function session(ctx: Ctx): Promise<Response> {
  const token = getCookie(ctx.req, SESSION_COOKIE);
  const claims = token ? await verifySessionJwt(ctx.env.JWT_SECRET, token) : null;
  if (!claims) return error("Not authenticated", 401);
  return json({ ok: true, expiresAt: claims.exp * 1000 });
}
