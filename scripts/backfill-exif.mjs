#!/usr/bin/env node
/**
 * Backfills taken_at / camera for images uploaded before EXIF indexing
 * existed. Reads each JPEG's first bytes through the gated /media route and
 * reuses the Worker's own parser (Node 23.6+ runs the .ts import natively).
 *
 *   GALLERY_URL=https://... GALLERY_PASSWORD=... node scripts/backfill-exif.mjs
 *
 * Prints UPDATE statements to migrate.sql and applies them with wrangler.
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseExif, EXIF_SCAN_BYTES } from "../src/worker/lib/exif.ts";

const BASE = process.env.GALLERY_URL ?? "https://shared-gallery.jonnokid.workers.dev";
const PASSWORD = process.env.GALLERY_PASSWORD;
if (!PASSWORD) {
  console.error("Set GALLERY_PASSWORD");
  process.exit(1);
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: PASSWORD }),
});
if (login.status !== 204) throw new Error(`login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("no session cookie");
const auth = { headers: { Cookie: cookie } };

// Collect every image page by page.
const images = [];
let cursor = null;
do {
  const qs = new URLSearchParams({ filter: "all", limit: "120" });
  if (cursor) qs.set("cursor", cursor);
  const page = await (await fetch(`${BASE}/api/images?${qs}`, auth)).json();
  images.push(...page.items);
  cursor = page.cursor;
} while (cursor);

// (i.takenAt ?? null): a Worker build predating EXIF indexing omits the
// field entirely, and undefined !== null.
const candidates = images.filter(
  (i) => i.contentType === "image/jpeg" && (i.takenAt ?? null) === null,
);
console.log(`${images.length} images, ${candidates.length} JPEGs need backfill`);

async function firstBytes(key) {
  const res = await fetch(`${BASE}/media/${encodeURIComponent(key)}`, auth);
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < EXIF_SCAN_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const esc = (s) => s.replaceAll("'", "''");
const updates = [];
let found = 0;
for (const img of candidates) {
  const bytes = await firstBytes(img.mediaKey);
  if (!bytes) continue;
  const exif = parseExif(bytes);
  if (exif.takenAt === null && exif.camera === null) continue;
  found++;
  updates.push(
    `UPDATE images SET taken_at = ${exif.takenAt ?? "NULL"}, camera = ${
      exif.camera ? `'${esc(exif.camera)}'` : "NULL"
    } WHERE id = '${esc(img.id)}';`,
  );
  console.log(
    `${img.originalName}: ${exif.takenAt ? new Date(exif.takenAt).toISOString() : "-"} ${exif.camera ?? ""}`,
  );
}

console.log(`\n${found}/${candidates.length} had EXIF data`);
if (updates.length === 0) process.exit(0);

writeFileSync("backfill-exif.sql", updates.join("\n") + "\n");
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "shared-gallery-db", "--remote", "-y", "--file", "backfill-exif.sql"],
  { stdio: "inherit" },
);
console.log("backfill applied");
