import { Router, type Ctx } from "./router";
import { error, json } from "./lib/json";
import { sanitizeDisplayName } from "./lib/displayName";
import { requireSession } from "./middleware";

const router = new Router();

router.get("/api/health", () => json({ ok: true }));

/**
 * Route registration happens in the phase modules; they attach themselves to
 * the shared router instance at module load.
 */
import { registerAuthRoutes } from "./routes/auth";
import { registerImageRoutes } from "./routes/images";
import { registerCollectionRoutes } from "./routes/collections";
import { registerMediaRoutes } from "./routes/media";
registerAuthRoutes(router);
registerImageRoutes(router);
registerCollectionRoutes(router);
registerMediaRoutes(router);

/** Paths that never require a session: health probe and the auth endpoints. */
function isPublicPath(path: string): boolean {
  return path === "/api/health" || path.startsWith("/api/auth/");
}

export default {
  async fetch(request, env, exec): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const isApi = path === "/api" || path.startsWith("/api/");
    const isMedia = path === "/media" || path.startsWith("/media/");
    if (!isApi && !isMedia) {
      // The open static shell (SPA HTML/JS/CSS). run_worker_first only lists
      // /api/* and /media/*, so this branch mostly runs in dev.
      return env.ASSETS.fetch(request);
    }

    const ctx: Ctx = {
      req: request,
      env,
      exec,
      url,
      params: {},
      displayName: sanitizeDisplayName(request.headers.get("X-Gallery-User")),
    };

    try {
      // Session gate: everything under /api/* and /media/* except health/auth.
      if (!isPublicPath(path)) {
        const denied = await requireSession(ctx);
        if (denied) return denied;
      }

      const match = router.match(request.method, path);
      if (!match) return error("Not found", 404);
      ctx.params = match.params;

      let response = await match.handler(ctx);

      // Sliding session renewal: attach the refreshed cookie when middleware
      // decided the token is close to expiry. API responses only — media
      // responses carry public Cache-Control and must stay cookie-free.
      if (isApi && ctx.renewCookie && !response.headers.has("Set-Cookie")) {
        response = new Response(response.body, response);
        response.headers.append("Set-Cookie", ctx.renewCookie);
      }
      return response;
    } catch (err) {
      console.error("Unhandled error", { path, method: request.method, err });
      return error("Internal server error", 500);
    }
  },
} satisfies ExportedHandler<Env>;
