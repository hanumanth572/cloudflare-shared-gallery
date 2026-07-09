/**
 * Minimal EXIF reader for JPEG originals: capture time and camera only.
 *
 * Pure byte parsing (no dependencies, negligible CPU) over the first bytes
 * of the file; the APP1/EXIF segment always precedes image data. The stored
 * original in R2 is byte-identical to the upload, so full metadata is always
 * preserved there; this only indexes the fields the UI shows into D1.
 *
 * Kept deliberately small: JPEG APP1 (the phone/camera case). Formats
 * without EXIF, or files where parsing fails, simply yield nulls.
 */

export interface ExifSummary {
  /** DateTimeOriginal (fallback DateTime), epoch ms, or null. */
  takenAt: number | null;
  /** "Make Model", e.g. "Apple iPhone 15 Pro", or null. */
  camera: string | null;
}

const EMPTY: ExifSummary = { takenAt: null, camera: null };

/** How many leading bytes are worth fetching for EXIF. */
export const EXIF_SCAN_BYTES = 256 * 1024;

export function parseExif(bytes: Uint8Array): ExifSummary {
  try {
    return parse(bytes);
  } catch {
    return EMPTY;
  }
}

function parse(bytes: Uint8Array): ExifSummary {
  // JPEG SOI
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return EMPTY;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Walk segments looking for APP1 "Exif\0\0"
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return EMPTY;
    const marker = bytes[pos + 1];
    if (marker === 0xda) return EMPTY; // start of scan: no EXIF ahead
    const segLen = view.getUint16(pos + 2, false);
    if (segLen < 2) return EMPTY;
    if (marker === 0xe1 && pos + 4 + 6 <= bytes.length) {
      const isExif =
        bytes[pos + 4] === 0x45 && // E
        bytes[pos + 5] === 0x78 && // x
        bytes[pos + 6] === 0x69 && // i
        bytes[pos + 7] === 0x66 && // f
        bytes[pos + 8] === 0x00 &&
        bytes[pos + 9] === 0x00;
      if (isExif) {
        const tiffStart = pos + 10;
        const tiffEnd = Math.min(pos + 2 + segLen, bytes.length);
        return parseTiff(bytes, view, tiffStart, tiffEnd);
      }
    }
    pos += 2 + segLen;
  }
  return EMPTY;
}

function parseTiff(
  bytes: Uint8Array,
  view: DataView,
  start: number,
  end: number,
): ExifSummary {
  if (start + 8 > end) return EMPTY;
  const little = bytes[start] === 0x49 && bytes[start + 1] === 0x49; // "II"
  const big = bytes[start] === 0x4d && bytes[start + 1] === 0x4d; // "MM"
  if (!little && !big) return EMPTY;
  const le = little;
  if (view.getUint16(start + 2, le) !== 0x2a) return EMPTY;

  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  const readAscii = (entryOffset: number): string | null => {
    const count = u32(entryOffset + 4);
    if (count === 0 || count > 512) return null;
    const valueAt = count <= 4 ? entryOffset + 8 : start + u32(entryOffset + 8);
    if (valueAt + count > end) return null;
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = bytes[valueAt + i];
      if (c === 0) break;
      // printable ASCII only; EXIF ASCII fields must be 7-bit
      if (c < 0x20 || c > 0x7e) return null;
      s += String.fromCharCode(c);
    }
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  interface Found {
    make?: string;
    model?: string;
    dateTime?: string;
    dateTimeOriginal?: string;
    exifIfd?: number;
  }
  const found: Found = {};

  const walkIfd = (ifdOffset: number, isExifIfd: boolean): void => {
    if (ifdOffset + 2 > end) return;
    const entries = u16(ifdOffset);
    if (entries > 200) return;
    for (let i = 0; i < entries; i++) {
      const e = ifdOffset + 2 + i * 12;
      if (e + 12 > end) return;
      const tag = u16(e);
      const type = u16(e + 2);
      if (!isExifIfd) {
        if (tag === 0x010f && type === 2) found.make = readAscii(e) ?? undefined;
        else if (tag === 0x0110 && type === 2) found.model = readAscii(e) ?? undefined;
        else if (tag === 0x0132 && type === 2) found.dateTime = readAscii(e) ?? undefined;
        else if (tag === 0x8769 && (type === 4 || type === 3)) found.exifIfd = u32(e + 8);
      } else if (tag === 0x9003 && type === 2) {
        found.dateTimeOriginal = readAscii(e) ?? undefined;
      }
    }
  };

  walkIfd(start + u32(start + 4), false);
  if (found.exifIfd !== undefined) walkIfd(start + found.exifIfd, true);

  const stamp = found.dateTimeOriginal ?? found.dateTime ?? null;
  let takenAt: number | null = null;
  if (stamp) {
    // "YYYY:MM:DD HH:MM:SS" (no timezone in EXIF; interpret as UTC)
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(stamp);
    if (m) {
      const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
      const ms = Date.UTC(y, mo - 1, d, h, mi, s);
      // Sanity: reject epoch-zero and far-future values
      if (Number.isFinite(ms) && ms > Date.UTC(1980, 0, 1) && ms < Date.now() + 86_400_000) {
        takenAt = ms;
      }
    }
  }

  let camera: string | null = null;
  if (found.make || found.model) {
    const make = found.make ?? "";
    const model = found.model ?? "";
    // Many models repeat the make ("Canon Canon EOS R5"); de-duplicate.
    camera = model.toLowerCase().startsWith(make.toLowerCase())
      ? model
      : `${make} ${model}`.trim();
    camera = camera.slice(0, 80);
    if (camera.length === 0) camera = null;
  }

  return { takenAt, camera };
}
