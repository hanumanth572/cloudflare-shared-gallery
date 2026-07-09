import type { Ctx, Router } from "../router";
import { error } from "../lib/json";

/**
 * Gated image byte serving.
 *
 *   GET /media/:key           — stream the original from R2 (full-res download)
 *   GET /media/:key?v=thumb   — 480w variant  (grid tiles)
 *   GET /media/:key?v=full    — 1600w variant (lightbox)
 *
 * Variants transform through the Images binding (Cloudflare's image
 * pipeline, not Worker CPU) and are cached in the Cache API with a long
 * immutable TTL. The cache check runs AFTER the session gate, and caching
 * stays inside the Worker on purpose: platform-level response caching would
 * serve gated bytes without running the Worker at all.
 *
 * The Cache API layer is what keeps repeat views from re-counting against
 * the 5,000 unique transformations / 30 days Free allowance.
 */

const VARIANTS = {
  thumb: { width: 480, quality: 78 },
  full: { width: 1600, quality: 85 },
} as const;

type VariantName = keyof typeof VARIANTS;

export function registerMediaRoutes(router: Router): void {
  router.get("/media/:key", serve);
}

async function serve(ctx: Ctx): Promise<Response> {
  const key = ctx.params.key;
  const variantRaw = ctx.url.searchParams.get("v");
  if (variantRaw === null) return serveOriginal(ctx, key);
  if (variantRaw !== "thumb" && variantRaw !== "full") {
    return error("Unknown variant; use v=thumb or v=full", 400);
  }
  return serveVariant(ctx, key, variantRaw);
}

async function serveOriginal(ctx: Ctx, key: string): Promise<Response> {
  const obj = await ctx.env.BUCKET.get(key);
  if (!obj) return error("Not found", 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // Originals are immutable (keys are unique per upload) but session-gated,
  // so only the browser's private cache may store them.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

/**
 * `format=auto` semantics, negotiated from the Accept header since the
 * binding requires an explicit output format. The chosen format is part of
 * the cache key so AVIF-capable and legacy browsers never share entries.
 */
function negotiateFormat(accept: string | null): {
  mime: "image/avif" | "image/webp" | "image/jpeg";
  label: string;
} {
  const a = accept ?? "";
  if (a.includes("image/avif")) return { mime: "image/avif", label: "avif" };
  if (a.includes("image/webp")) return { mime: "image/webp", label: "webp" };
  return { mime: "image/jpeg", label: "jpeg" };
}

async function serveVariant(ctx: Ctx, key: string, variant: VariantName): Promise<Response> {
  const format = negotiateFormat(ctx.req.headers.get("Accept"));

  // Normalized cache key: key + variant + negotiated format, nothing else.
  const cacheUrl = new URL(ctx.url.origin);
  cacheUrl.pathname = `/media/${encodeURIComponent(key)}`;
  cacheUrl.searchParams.set("v", variant);
  cacheUrl.searchParams.set("f", format.label);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("X-Gallery-Cache", "hit");
    return hit;
  }

  const obj = await ctx.env.BUCKET.get(key);
  if (!obj) return error("Not found", 404);

  const preset = VARIANTS[variant];
  try {
    // Stream R2 → Images pipeline; the original is never buffered in memory.
    const transformed = await ctx.env.IMAGES.input(obj.body)
      .transform({ width: preset.width, fit: "scale-down" })
      .output({ format: format.mime, quality: preset.quality });

    const upstream = transformed.response();
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Vary", "Accept");
    headers.set("X-Gallery-Cache", "miss");
    const response = new Response(upstream.body, { status: 200, headers });

    // Store before returning so the next request never re-transforms.
    ctx.exec.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    // Transform can fail for originals past the binding's 20 MB input limit
    // or exotic payloads; degrade to the original bytes rather than a broken
    // tile. (obj.body may be locked after a failed transform — re-fetch.)
    console.warn("Variant transform failed; serving original", { key, variant, err });
    return serveOriginal(ctx, key);
  }
}
