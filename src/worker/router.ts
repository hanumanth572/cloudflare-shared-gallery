import { error } from "./lib/json";

/** Per-request context handed to every route handler. */
export interface Ctx {
  req: Request;
  env: Env;
  exec: ExecutionContext;
  url: URL;
  params: Record<string, string>;
  /** Sanitized X-Gallery-User header value; attribution only, never authorization. */
  displayName: string | null;
  /**
   * Set by the session middleware when sliding renewal fires; the router
   * appends it as a Set-Cookie header on the outgoing response.
   */
  renewCookie?: string;
}

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

/**
 * Minimal method + path router. Patterns are slash-separated with `:name`
 * parameter segments, e.g. `/api/collections/:id/images/:imageId`.
 */
export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, segments: split(pattern), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.on("GET", pattern, handler);
  }
  post(pattern: string, handler: Handler): this {
    return this.on("POST", pattern, handler);
  }
  patch(pattern: string, handler: Handler): this {
    return this.on("PATCH", pattern, handler);
  }
  delete(pattern: string, handler: Handler): this {
    return this.on("DELETE", pattern, handler);
  }

  /** Returns the matched handler + params, or null when nothing matches. */
  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = split(path);
    let pathMatched = false;
    for (const route of this.routes) {
      const params = matchSegments(route.segments, parts);
      if (!params) continue;
      pathMatched = true;
      if (route.method === method) return { handler: route.handler, params };
    }
    // Path exists but method is wrong.
    if (pathMatched) return { handler: () => error("Method not allowed", 405), params: {} };
    return null;
  }
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  if (pattern.length !== parts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const pat = pattern[i];
    const part = parts[i];
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(part);
    } else if (pat !== part) {
      return null;
    }
  }
  return params;
}
