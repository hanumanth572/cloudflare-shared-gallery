import { useState } from "react";
import { useImageFeed } from "../lib/useImageFeed";
import ImageGrid from "../components/ImageGrid";
import Lightbox from "../components/Lightbox";
import EmptyState from "../components/EmptyState";

/** All Images: a flat grid of every photo, newest first. */
export default function AllImages() {
  const feed = useImageFeed({ kind: "all" });
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (feed.error && feed.images.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Couldn't load photos"
        message={feed.error}
        action={
          <button
            onClick={feed.refresh}
            className="min-h-11 rounded-xl bg-stone-800 px-4 text-sm text-stone-200 hover:bg-stone-700"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (feed.ready && feed.images.length === 0) {
    return (
      <EmptyState
        icon="📷"
        title="No photos yet"
        message="Tap the + button to add the first photos to the gallery."
      />
    );
  }

  return (
    <>
      <ImageGrid
        images={feed.images}
        onOpen={setLightbox}
        hasMore={feed.hasMore}
        loading={feed.loading}
        onLoadMore={feed.loadMore}
      />
      {lightbox !== null && feed.images[lightbox] && (
        <Lightbox
          images={feed.images}
          index={lightbox}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
          onImageUpdated={feed.replaceImage}
          onImageDeleted={feed.removeImage}
          onNearEnd={feed.loadMore}
        />
      )}
    </>
  );
}
