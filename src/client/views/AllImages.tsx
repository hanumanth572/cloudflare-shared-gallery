import { useImageFeed } from "../lib/useImageFeed";
import PhotoSection from "../components/PhotoSection";
import EmptyState from "../components/EmptyState";
import { IconImage } from "../components/icons";

/** All Images: a flat grid of every photo, newest first. */
export default function AllImages() {
  const feed = useImageFeed({ kind: "all" });

  return (
    <PhotoSection
      feed={feed}
      header={<h2 className="truncate text-sm font-medium uppercase tracking-widest text-stone-500">All photos</h2>}
      emptyState={
        <EmptyState
          icon={<IconImage />}
          title="No photos yet"
          message="Tap the + button to add the first photos to the gallery."
        />
      }
    />
  );
}
