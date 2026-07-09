#!/usr/bin/env node
/**
 * Generates the PWA icon set into public/icons/ with zero dependencies
 * (hand-encoded PNG: amber gradient, mountain + sun glyph).
 *
 *   node scripts/mk-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function pngFromRGBA(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolor + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Signed-distance helpers evaluated per (normalized) sample point. */
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function makeIcon(size, { rounded }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling
  const radius = rounded ? size * 0.22 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;

          // Rounded-square mask
          if (radius > 0) {
            const cx = Math.max(radius / size, Math.min(1 - radius / size, px));
            const cy = Math.max(radius / size, Math.min(1 - radius / size, py));
            const d = Math.hypot((px - cx) * size, (py - cy) * size);
            if (d > radius) continue;
          }

          // Amber gradient background
          let cr = 0xfb + (0xd9 - 0xfb) * py;
          let cg = 0xbf + (0x77 - 0xbf) * py;
          let cb = 0x24 + (0x06 - 0x24) * py;

          // Sun
          if (Math.hypot(px - 0.7, py - 0.3) < 0.1) {
            cr = 255; cg = 251; cb = 235;
          }
          // Mountains (two peaks, drawn dark charcoal)
          const inBig = inTriangle(px, py, [0.36, 0.34], [0.08, 0.8], [0.64, 0.8]);
          const inSmall = inTriangle(px, py, [0.66, 0.5], [0.44, 0.8], [0.92, 0.8]);
          if (inBig || inSmall) {
            cr = 0x1c; cg = 0x19; cb = 0x17;
          }

          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(r / n);
      rgba[o + 1] = Math.round(g / n);
      rgba[o + 2] = Math.round(b / n);
      rgba[o + 3] = Math.round(a / n);
    }
  }
  return pngFromRGBA(size, size, rgba);
}

const targets = [
  ["icon-192.png", 192, { rounded: true }],
  ["icon-512.png", 512, { rounded: true }],
  ["icon-maskable-512.png", 512, { rounded: false }],
  ["apple-touch-icon.png", 180, { rounded: false }],
];
for (const [name, size, opts] of targets) {
  const png = makeIcon(size, opts);
  writeFileSync(join(outDir, name), png);
  console.log(`${name}: ${size}x${size}, ${png.length} bytes`);
}
