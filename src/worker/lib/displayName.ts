/**
 * Sanitizes the self-declared X-Gallery-User header. This is a soft display
 * label for attribution only — never an identity or authorization input.
 * Trim, cap at 40 characters, strip control characters, empty becomes null.
 */
export function sanitizeDisplayName(raw: string | null): string | null {
  if (!raw) return null;
  let name = "";
  try {
    // The client percent-encodes so non-ASCII names survive the header.
    name = decodeURIComponent(raw);
  } catch {
    name = raw;
  }
  name = name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40).trim();
  return name.length > 0 ? name : null;
}
