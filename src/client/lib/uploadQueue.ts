import { useSyncExternalStore } from "react";
import { uploadImage } from "./api";
import { emit } from "./events";

/**
 * App-wide upload queue. Both the upload buttons and the page-wide drop zone
 * feed files in here, so dropping hundreds of images at once is safe:
 * uploads run at most CONCURRENCY at a time, progress re-renders are
 * throttled, and gallery refresh events are debounced instead of firing once
 * per completed file.
 */

export interface QueueItem {
  key: string;
  name: string;
  /** 0..1 */
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

interface InternalItem extends QueueItem {
  file: File;
}

const CONCURRENCY = 3;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

let items: InternalItem[] = [];
let active = 0;
let snapshot: QueueItem[] = [];
let snapshotDirty = true;
const listeners = new Set<() => void>();

function notify(): void {
  snapshotDirty = true;
  for (const l of listeners) l();
}

/* Progress events arrive per-chunk per-file; cap re-renders at ~10/s. */
let progressTimer: ReturnType<typeof setTimeout> | null = null;
function notifyProgressThrottled(): void {
  if (progressTimer) return;
  progressTimer = setTimeout(() => {
    progressTimer = null;
    notify();
  }, 100);
}

/* Feeds refresh on "images-changed"; debounce so a 300-file drop does not
   trigger 300 refetches. Fires at most every 2s while uploading, plus once
   immediately when the queue drains. */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleImagesChanged(): void {
  const drained = !items.some((i) => i.status === "queued" || i.status === "uploading");
  if (drained) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    emit("images-changed");
    return;
  }
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    emit("images-changed");
  }, 2000);
}

function pump(): void {
  while (active < CONCURRENCY) {
    const next = items.find((i) => i.status === "queued");
    if (!next) break;
    next.status = "uploading";
    active++;
    uploadImage(next.file, (fraction) => {
      next.progress = fraction;
      notifyProgressThrottled();
    })
      .then(() => {
        next.status = "done";
        next.progress = 1;
        scheduleImagesChanged();
      })
      .catch((err: unknown) => {
        next.status = "error";
        next.error = !navigator.onLine
          ? "You're offline. Uploads need a connection"
          : err instanceof Error
            ? err.message
            : "Upload failed";
      })
      .finally(() => {
        active--;
        notify();
        pump();
      });
  }
  notify();
}

/** Adds image files to the queue and starts (or continues) uploading. */
export function enqueueUploads(files: File[]): void {
  for (const file of files) {
    const item: InternalItem = {
      key: crypto.randomUUID(),
      name: file.name,
      file,
      progress: 0,
      status: "queued",
    };
    if (file.size > MAX_UPLOAD_BYTES) {
      item.status = "error";
      item.error = "Larger than the 50 MB limit";
    }
    items.push(item);
  }
  pump();
}

/** Re-queues every failed item (used by “Retry all” and per-file retry). */
export function retryFailed(key?: string): void {
  for (const item of items) {
    if (item.status !== "error") continue;
    if (key && item.key !== key) continue;
    if (item.file.size > MAX_UPLOAD_BYTES) continue; // permanently too big
    item.status = "queued";
    item.progress = 0;
    item.error = undefined;
  }
  pump();
}

/** Drops finished (done) items; keeps failures until dismissed. */
export function clearCompleted(): void {
  items = items.filter((i) => i.status !== "done");
  notify();
}

/** Dismisses one failed item, or the whole tray when everything is settled. */
export function dismiss(key?: string): void {
  items = key
    ? items.filter((i) => i.key !== key)
    : items.filter((i) => i.status === "queued" || i.status === "uploading");
  notify();
}

function getSnapshot(): QueueItem[] {
  if (snapshotDirty) {
    snapshot = items.map(({ file: _file, ...rest }) => ({ ...rest }));
    snapshotDirty = false;
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live queue contents for the tray UI. */
export function useUploadQueue(): QueueItem[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
