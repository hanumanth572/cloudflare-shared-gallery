import type {
  ApiCollection,
  ApiImage,
  ApiImageMembership,
  ImageFilter,
  Paginated,
} from "../../shared/types";

/** Raw D1 row shapes (snake_case, as stored). */
interface ImageRow {
  id: string;
  r2_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  uploaded_by: string | null;
  taken_at: number | null;
  camera: string | null;
  deleted_at: number | null;
  deleted_by: string | null;
  created_at: number;
  updated_at: number;
}

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

type CollectionListRow = CollectionRow & {
  member_count: number;
  effective_cover_id: string | null;
};

export function rowToImage(row: ImageRow): ApiImage {
  return {
    id: row.id,
    mediaKey: row.r2_key,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    caption: row.caption,
    uploadedBy: row.uploaded_by,
    takenAt: row.taken_at,
    camera: row.camera,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCollection(row: CollectionListRow, cover: ApiImage | null): ApiCollection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverImageId: row.cover_image_id,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.member_count,
    cover,
  };
}

/* ------------------------------ pagination ------------------------------ */

interface CursorPayload {
  t: number; // created_at of the last item
  i: string; // id of the last item (tiebreak)
}

export function encodeCursor(lastCreatedAt: number, lastId: string): string {
  const payload: CursorPayload = { t: lastCreatedAt, i: lastId };
  return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const b64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const parsed = JSON.parse(atob(b64)) as CursorPayload;
    if (typeof parsed.t !== "number" || typeof parsed.i !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clampLimit(raw: string | null, fallback = 60, max = 120): number {
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/* -------------------------------- images -------------------------------- */

export interface NewImage {
  id: string;
  r2Key: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  takenAt: number | null;
  camera: string | null;
  createdAt: number;
}

export async function insertImage(db: D1Database, img: NewImage): Promise<void> {
  await db
    .prepare(
      `INSERT INTO images (id, r2_key, original_name, content_type, size_bytes, width, height, caption, uploaded_by, taken_at, camera, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    )
    .bind(
      img.id,
      img.r2Key,
      img.originalName,
      img.contentType,
      img.sizeBytes,
      img.width,
      img.height,
      img.uploadedBy,
      img.takenAt,
      img.camera,
      img.createdAt,
      img.createdAt,
    )
    .run();
}

export async function getImage(db: D1Database, id: string): Promise<ApiImage | null> {
  const row = await db
    .prepare(`SELECT * FROM images WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<ImageRow>();
  return row ? rowToImage(row) : null;
}

export async function getImageByKey(db: D1Database, r2Key: string): Promise<ApiImage | null> {
  const row = await db
    .prepare(`SELECT * FROM images WHERE r2_key = ?`)
    .bind(r2Key)
    .first<ImageRow>();
  return row ? rowToImage(row) : null;
}

export async function listImages(
  db: D1Database,
  opts: {
    filter: ImageFilter;
    cursor: string | null;
    limit: number;
    /** Restrict to photos uploaded by this display name. */
    uploader?: string | null;
  },
): Promise<Paginated<ApiImage>> {
  const after = opts.cursor ? decodeCursor(opts.cursor) : null;
  const join =
    opts.filter === "untagged" ? `LEFT JOIN image_collections ic ON ic.image_id = i.id` : "";
  const where: string[] = [`i.deleted_at IS NULL`];
  const binds: unknown[] = [];
  if (opts.filter === "untagged") where.push(`ic.image_id IS NULL`);
  if (opts.uploader) {
    where.push(`i.uploaded_by = ?`);
    binds.push(opts.uploader);
  }
  if (after) {
    where.push(`(i.created_at < ? OR (i.created_at = ? AND i.id < ?))`);
    binds.push(after.t, after.t, after.i);
  }
  binds.push(opts.limit + 1);

  const sql = `SELECT i.* FROM images i ${join}
     WHERE ${where.join(" AND ")}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ?`;
  const { results } = await db.prepare(sql).bind(...binds).all<ImageRow>();
  return paginate(results, opts.limit);
}

function paginate(rows: ImageRow[], limit: number): Paginated<ApiImage> {
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(rowToImage),
    cursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

export async function updateImageCaption(
  db: D1Database,
  id: string,
  caption: string | null,
  now: number,
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE images SET caption = ?, updated_at = ? WHERE id = ?`)
    .bind(caption, now, id)
    .run();
  return res.meta.changes > 0;
}

/** How long soft-deleted photos stay recoverable before the lazy purge. */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Soft delete: marks the row and keeps both the R2 object and the junction
 * rows, so a restore brings memberships back too. Nothing is destroyed here.
 */
export async function softDeleteImage(
  db: D1Database,
  id: string,
  deletedBy: string | null,
  now: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE images SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(now, deletedBy, now, id)
    .run();
  return res.meta.changes > 0;
}

export async function restoreImage(db: D1Database, id: string, now: number): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE images SET deleted_at = NULL, deleted_by = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, id)
    .run();
  return res.meta.changes > 0;
}

export async function listDeletedImages(db: D1Database): Promise<ApiImage[]> {
  const { results } = await db
    .prepare(`SELECT * FROM images WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500`)
    .all<ImageRow>();
  return results.map(rowToImage);
}

/**
 * Permanently removes photos whose recovery window has passed: R2 objects
 * first (one bulk call), then the rows (junction rows cascade). Called
 * opportunistically via waitUntil; the only hard-delete path in the app.
 */
export async function purgeExpiredDeletions(db: D1Database, bucket: R2Bucket, now: number): Promise<number> {
  const cutoff = now - PURGE_AFTER_MS;
  const { results } = await db
    .prepare(`SELECT id, r2_key FROM images WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 50`)
    .bind(cutoff)
    .all<{ id: string; r2_key: string }>();
  if (results.length === 0) return 0;
  await bucket.delete(results.map((r) => r.r2_key));
  const placeholders = results.map(() => "?").join(", ");
  await db
    .prepare(`DELETE FROM images WHERE id IN (${placeholders})`)
    .bind(...results.map((r) => r.id))
    .run();
  return results.length;
}

export async function getImageMemberships(
  db: D1Database,
  imageId: string,
): Promise<ApiImageMembership[]> {
  const { results } = await db
    .prepare(
      `SELECT ic.collection_id, c.name, c.slug, ic.added_by, ic.added_at
       FROM image_collections ic
       JOIN collections c ON c.id = ic.collection_id
       WHERE ic.image_id = ?
       ORDER BY c.sort_order ASC, c.name ASC`,
    )
    .bind(imageId)
    .all<{
      collection_id: string;
      name: string;
      slug: string;
      added_by: string | null;
      added_at: number;
    }>();
  return results.map((r) => ({
    collectionId: r.collection_id,
    name: r.name,
    slug: r.slug,
    addedBy: r.added_by,
    addedAt: r.added_at,
  }));
}

/* ------------------------------ collections ----------------------------- */

const COLLECTION_LIST_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM image_collections ic
     JOIN images i ON i.id = ic.image_id AND i.deleted_at IS NULL
     WHERE ic.collection_id = c.id) AS member_count,
    COALESCE(
      (SELECT c.cover_image_id FROM images ci
       WHERE ci.id = c.cover_image_id AND ci.deleted_at IS NULL),
      (SELECT ic.image_id FROM image_collections ic
       JOIN images i ON i.id = ic.image_id AND i.deleted_at IS NULL
       WHERE ic.collection_id = c.id
       ORDER BY ic.added_at DESC LIMIT 1)
    ) AS effective_cover_id
  FROM collections c`;

async function attachCovers(
  db: D1Database,
  rows: CollectionListRow[],
): Promise<ApiCollection[]> {
  const coverIds = [...new Set(rows.map((r) => r.effective_cover_id).filter((x): x is string => !!x))];
  const covers = new Map<string, ApiImage>();
  if (coverIds.length > 0) {
    const placeholders = coverIds.map(() => "?").join(", ");
    const { results } = await db
      .prepare(`SELECT * FROM images WHERE id IN (${placeholders})`)
      .bind(...coverIds)
      .all<ImageRow>();
    for (const row of results) covers.set(row.id, rowToImage(row));
  }
  return rows.map((r) =>
    rowToCollection(r, r.effective_cover_id ? (covers.get(r.effective_cover_id) ?? null) : null),
  );
}

export async function listCollections(db: D1Database): Promise<ApiCollection[]> {
  const { results } = await db
    .prepare(`${COLLECTION_LIST_SQL} ORDER BY c.sort_order ASC, c.created_at DESC`)
    .all<CollectionListRow>();
  return attachCovers(db, results);
}

export async function getCollection(db: D1Database, id: string): Promise<ApiCollection | null> {
  const row = await db
    .prepare(`${COLLECTION_LIST_SQL} WHERE c.id = ?`)
    .bind(id)
    .first<CollectionListRow>();
  if (!row) return null;
  const [collection] = await attachCovers(db, [row]);
  return collection;
}

export async function getCollectionBySlug(db: D1Database, slug: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS one FROM collections WHERE slug = ?`)
    .bind(slug)
    .first<{ one: number }>();
  return row !== null;
}

export interface NewCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdBy: string | null;
  createdAt: number;
}

export async function insertCollection(db: D1Database, c: NewCollection): Promise<void> {
  await db
    .prepare(
      `INSERT INTO collections (id, name, slug, description, cover_image_id, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
    )
    .bind(c.id, c.name, c.slug, c.description, c.createdBy, c.createdAt, c.createdAt)
    .run();
}

export interface CollectionPatch {
  name?: string;
  description?: string | null;
  coverImageId?: string | null;
  sortOrder?: number;
}

export async function updateCollection(
  db: D1Database,
  id: string,
  patch: CollectionPatch,
  now: number,
): Promise<boolean> {
  const sets: string[] = ["updated_at = ?"];
  const binds: unknown[] = [now];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    binds.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push("description = ?");
    binds.push(patch.description);
  }
  if (patch.coverImageId !== undefined) {
    sets.push("cover_image_id = ?");
    binds.push(patch.coverImageId);
  }
  if (patch.sortOrder !== undefined) {
    sets.push("sort_order = ?");
    binds.push(patch.sortOrder);
  }
  binds.push(id);
  const res = await db
    .prepare(`UPDATE collections SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
  return res.meta.changes > 0;
}

/** Deletes the collection; images survive, membership rows cascade away. */
export async function deleteCollection(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare(`DELETE FROM collections WHERE id = ?`).bind(id).run();
  return res.meta.changes > 0;
}

export async function listCollectionImages(
  db: D1Database,
  collectionId: string,
  opts: { cursor: string | null; limit: number },
): Promise<Paginated<ApiImage>> {
  const after = opts.cursor ? decodeCursor(opts.cursor) : null;
  const cursorWhere = after ? `AND (i.created_at < ?2 OR (i.created_at = ?2 AND i.id < ?3))` : "";
  const sql = `SELECT i.* FROM images i
     JOIN image_collections ic ON ic.image_id = i.id
     WHERE ic.collection_id = ?1 AND i.deleted_at IS NULL ${cursorWhere}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ${after ? "?4" : "?2"}`;
  const stmt = after
    ? db.prepare(sql).bind(collectionId, after.t, after.i, opts.limit + 1)
    : db.prepare(sql).bind(collectionId, opts.limit + 1);
  const { results } = await stmt.all<ImageRow>();
  return paginate(results, opts.limit);
}

/** Adds images to a collection, idempotently. Returns how many rows were new. */
export async function addImagesToCollection(
  db: D1Database,
  collectionId: string,
  imageIds: string[],
  addedBy: string | null,
  now: number,
): Promise<number> {
  if (imageIds.length === 0) return 0;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO image_collections (image_id, collection_id, added_by, added_at)
     SELECT id, ?, ?, ? FROM images WHERE id = ?`,
  );
  const results = await db.batch(
    imageIds.map((imageId) => stmt.bind(collectionId, addedBy, now, imageId)),
  );
  return results.reduce((sum, r) => sum + r.meta.changes, 0);
}

export async function removeImageFromCollection(
  db: D1Database,
  collectionId: string,
  imageId: string,
): Promise<boolean> {
  const res = await db
    .prepare(`DELETE FROM image_collections WHERE collection_id = ? AND image_id = ?`)
    .bind(collectionId, imageId)
    .run();
  return res.meta.changes > 0;
}

/* ----------------------------- login throttle ---------------------------- */

export const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
export const THROTTLE_MAX_FAILURES = 10;

/**
 * Returns true when the IP has exceeded the failure budget inside the window.
 * Opportunistically prunes rows older than the window to keep the table small.
 */
export async function isThrottled(db: D1Database, ip: string, now: number): Promise<boolean> {
  const windowStart = now - THROTTLE_WINDOW_MS;
  await db.prepare(`DELETE FROM login_attempts WHERE attempted_at < ?`).bind(windowStart).run();
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at >= ?`)
    .bind(ip, windowStart)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= THROTTLE_MAX_FAILURES;
}

export async function recordLoginFailure(db: D1Database, ip: string, now: number): Promise<void> {
  await db
    .prepare(`INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)`)
    .bind(ip, now)
    .run();
}

export async function clearLoginFailures(db: D1Database, ip: string): Promise<void> {
  await db.prepare(`DELETE FROM login_attempts WHERE ip = ?`).bind(ip).run();
}
