/**
 * The self-declared display name, stored per device in localStorage.
 * Attribution only — never used for authorization.
 */

const KEY = "sg_display_name";

export function getStoredDisplayName(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    const name = raw?.trim() ?? "";
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function storeDisplayName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length > 0) localStorage.setItem(KEY, trimmed);
  } catch {
    // Storage unavailable (private mode); the app still works, unattributed.
  }
}
