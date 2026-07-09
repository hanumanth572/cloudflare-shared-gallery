import { getUpdates } from "./api";

/**
 * "New since your last visit" watermark, stored per device in localStorage.
 *
 * Semantics: opening the app counts as reading. On boot we compare the
 * stored watermark against the gallery, remember the result for this visit
 * (banner + tile dots), and immediately advance the watermark so the next
 * visit measures from now. First-ever visits show nothing.
 */

const KEY = "sg_last_seen";

export interface VisitUpdates {
  /** Photos added by other people since the previous visit. */
  newCount: number;
  /** Watermark of the previous visit; tiles newer than this get a dot. */
  since: number | null;
}

let bootCheck: Promise<VisitUpdates> | null = null;

/** Session-stable result; safe to call from anywhere (memoized). */
export function checkVisitUpdates(): Promise<VisitUpdates> {
  bootCheck ??= (async () => {
    let since: number | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      since = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return { newCount: 0, since: null };
    }

    try {
      const res = await getUpdates(since ?? 0);
      const next = res.latestCreatedAt ?? Date.now();
      localStorage.setItem(KEY, String(next));
      // First visit: set the watermark quietly, mark nothing as new.
      if (since === null) return { newCount: 0, since: null };
      sessionSince = since;
      return { newCount: res.newCount, since };
    } catch {
      return { newCount: 0, since };
    }
  })();
  return bootCheck;
}

/** Frozen watermark for this visit, for synchronous "is this tile new?" checks. */
let sessionSince: number | null = null;

export function getSessionSince(): number | null {
  return sessionSince;
}
