import type { Ctx } from "./router";
import { error } from "./lib/json";
import {
  RENEW_THRESHOLD_S,
  SESSION_COOKIE,
  getCookie,
  mintSessionJwt,
  sessionCookie,
  sessionTtlDays,
  verifySessionJwt,
} from "./lib/auth";

/**
 * Session gate applied to every /api/* route (except health and auth) and to
 * all /media/* routes. Returns a 401 Response to short-circuit the request,
 * or null to let it through.
 *
 * Sliding renewal: when the token is within 7 days of expiry, a fresh cookie
 * is staged on ctx.renewCookie; the entry point appends it to the response so
 * active members are effectively never logged out.
 */
export async function requireSession(ctx: Ctx): Promise<Response | null> {
  const token = getCookie(ctx.req, SESSION_COOKIE);
  if (!token) return error("Not authenticated", 401);

  const claims = await verifySessionJwt(ctx.env.JWT_SECRET, token);
  if (!claims) return error("Not authenticated", 401);

  const nowS = Math.floor(Date.now() / 1000);
  if (claims.exp - nowS < RENEW_THRESHOLD_S) {
    const ttlDays = sessionTtlDays(ctx.env);
    const fresh = await mintSessionJwt(ctx.env.JWT_SECRET, ttlDays);
    ctx.renewCookie = sessionCookie(
      fresh,
      ttlDays * 24 * 60 * 60,
      ctx.url.protocol === "https:",
    );
  }
  return null;
}
