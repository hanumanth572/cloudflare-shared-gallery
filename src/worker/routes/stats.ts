import type { Ctx, Router } from "../router";
import { json } from "../lib/json";
import type { ApiStats } from "../../shared/types";

/** R2 Free plan storage allowance; the bucket holds originals only. */
const R2_FREE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export function registerStatsRoutes(router: Router): void {
  router.get("/api/stats", stats);
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
