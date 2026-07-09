import type { Ctx, Router } from "../router";
import { error, json } from "../lib/json";
import type { ApiStats } from "../../shared/types";

/** R2 Free plan storage allowance; the bucket holds originals only. */
const R2_FREE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export function registerStatsRoutes(router: Router): void {
  router.get("/api/stats", stats);
  router.get("/api/updates", updates);
}

/**
 * GET /api/updates?since=<epoch ms> — how many photos other people added
 * after the caller's last visit, plus the newest photo timestamp overall
 * (the client stores that as its next watermark). The caller's own uploads
 * are excluded via the X-Gallery-User display name; a soft label is fine
 * here because this is presentation, not authorization.
 */
async function updates(ctx: Ctx): Promise<Response> {
  const since = Number.parseInt(ctx.url.searchParams.get("since") ?? "", 10);
  if (!Number.isFinite(since) || since < 0) {
    return error("since must be an epoch-milliseconds timestamp", 400);
  }
  const row = await ctx.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM images
        WHERE created_at > ?1 AND (uploaded_by IS NULL OR uploaded_by != ?2)) AS new_count,
       (SELECT MAX(created_at) FROM images) AS latest
     `,
  )
    .bind(since, ctx.displayName ?? "")
    .first<{ new_count: number; latest: number | null }>();

  return json({
    newCount: row?.new_count ?? 0,
    latestCreatedAt: row?.latest ?? null,
  });
}

/**
 * GET /api/stats — gallery totals for the footer: photo count, distinct
 * contributors (any attribution name seen on uploads, tagging, or
 * collections), and storage used against the Free-plan R2 limit.
 */
async function stats(ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM images) AS image_count,
       (SELECT COALESCE(SUM(size_bytes), 0) FROM images) AS bytes_used,
       (SELECT COUNT(*) FROM (
          SELECT uploaded_by AS name FROM images WHERE uploaded_by IS NOT NULL
          UNION
          SELECT created_by FROM collections WHERE created_by IS NOT NULL
          UNION
          SELECT added_by FROM image_collections WHERE added_by IS NOT NULL
       )) AS contributor_count`,
  ).first<{ image_count: number; bytes_used: number; contributor_count: number }>();

  const body: ApiStats = {
    imageCount: row?.image_count ?? 0,
    contributorCount: row?.contributor_count ?? 0,
    bytesUsed: row?.bytes_used ?? 0,
    bytesLimit: R2_FREE_LIMIT_BYTES,
  };
  return json(body);
}
