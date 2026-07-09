import { useEffect, useRef } from "react";
import type { ApiImage } from "../../shared/types";
import ImageTile from "./ImageTile";

/**
 * Responsive photo grid: 2 columns on narrow phones up to 6 on wide desktop,
 * with an IntersectionObserver sentinel for cursor-based infinite scroll.
 * Tile presses bubble up with their index and shift state so the parent can
 * open the lightbox, toggle selection, or select a shift-click range.
 */
export default function ImageGrid({
  images,
  onTilePress,
  hasMore,
  loading,
  onLoadMore,
  selectable = false,
  selectedIds,
}: {
  images: ApiImage[];
  onTilePress: (index: number, opts: { shift: boolean }) => void;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !loading) onLoadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
        {images.map((image, i) => (
          <ImageTile
            key={image.id}
            image={image}
            onPress={(opts) => onTilePress(i, opts)}
            selectable={selectable}
            selected={selectedIds?.has(image.id) ?? false}
          />
        ))}
        {loading &&
          images.length === 0 &&
          Array.from({ length: 12 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="aspect-square animate-pulse rounded-lg bg-stone-800/60"
              aria-hidden
            />
          ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
      {loading && images.length > 0 && (
        <div className="flex justify-center py-6" role="status" aria-label="Loading more photos">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-700 border-t-amber-400" />
        </div>
      )}
    </>
  );
}
