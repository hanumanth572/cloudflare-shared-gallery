/**
 * Tiny app-wide pub/sub so uploads and tagging can tell open views to
 * refresh without threading callbacks through the whole tree.
 */

type GalleryEvent = "images-changed" | "collections-changed";

export function emit(event: GalleryEvent): void {
  window.dispatchEvent(new CustomEvent(`sg:${event}`));
}

export function subscribe(event: GalleryEvent, handler: () => void): () => void {
  const name = `sg:${event}`;
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}
