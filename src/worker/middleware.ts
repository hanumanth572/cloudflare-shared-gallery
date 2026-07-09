import type { Ctx } from "./router";
import { error } from "./lib/json";

/**
 * Session gate applied to every /api/* route (except health and auth) and to
 * all /media/* routes. Returns a 401 Response to short-circuit the request,
 * or null to let it through. Full JWT verification lands in Phase 2.
 */
export async function requireSession(ctx: Ctx): Promise<Response | null> {
  void ctx;
  return error("Not authenticated", 401);
}
