import { useState, type ReactNode } from "react";
import type { ApiImageDetail } from "../../shared/types";
import type { ImageFeed } from "../lib/useImageFeed";
import ImageGrid from "./ImageGrid";
import Lightbox from "./Lightbox";
import CollectionPicker from "./CollectionPicker";
import SelectionBar from "./SelectionBar";
import EmptyState from "./EmptyState";
import { IconAlert } from "./icons";

export interface SelectionContext {
  selectedIds: Set<string>;
  clear: () => void;
}

/**
 * A photo grid with everything attached: lightbox, multi-select with
 * add-to-collection, and loading/error/empty states. Views compose this and
 * can add extra selection actions (e.g. remove from collection).
 */
export default function PhotoSection({
  feed,
  emptyState,
  header,
  extraSelectionActions,
}: {
  feed: ImageFeed;
  emptyState: ReactNode;
  /** Rendered above the grid, next to the Select toggle. */
  header?: ReactNode;
  extraSelectionActions?: (ctx: SelectionContext) => ReactNode;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<
    | { imageIds: string[]; current?: Set<string> }
    | null
  >(null);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  function openPickerForDetail(detail: ApiImageDetail) {
    setPicker({
      imageIds: [detail.id],
      current: new Set(detail.collections.map((m) => m.collectionId)),
    });
  }

  if (feed.error && feed.images.length === 0) {
    return (
      <EmptyState
        icon={<IconAlert />}
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
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{header}</div>
        {feed.images.length > 0 && (
          <button
            onClick={() => (selecting ? clearSelection() : setSelecting(true))}
            aria-pressed={selecting}
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm ${
              selecting
                ? "bg-stone-800 text-amber-400"
                : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
            }`}
          >
            {selecting ? "Done" : "Select"}
          </button>
        )}
      </div>

      <ImageGrid
        images={feed.images}
        onOpen={setLightbox}
        hasMore={feed.hasMore}
        loading={feed.loading}
        onLoadMore={feed.loadMore}
        selectable={selecting}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      {selecting && selectedIds.size > 0 && (
        <SelectionBar count={selectedIds.size} onCancel={clearSelection}>
          <button
            onClick={() => setPicker({ imageIds: [...selectedIds] })}
            className="min-h-11 rounded-lg bg-amber-400 px-3 text-sm font-medium text-stone-950 hover:bg-amber-300"
          >
            Add to collection
          </button>
          {extraSelectionActions?.({ selectedIds, clear: clearSelection })}
        </SelectionBar>
      )}

      {lightbox !== null && feed.images[lightbox] && (
        <Lightbox
          images={feed.images}
          index={lightbox}
          onNavigate={setLightbox}
          onClose={() => setLightbox(null)}
          onImageUpdated={feed.replaceImage}
          onImageDeleted={feed.removeImage}
          onNearEnd={feed.loadMore}
          onEditCollections={openPickerForDetail}
        />
      )}

      {picker && (
        <CollectionPicker
          imageIds={picker.imageIds}
          current={picker.current}
          onClose={() => setPicker(null)}
          onApplied={clearSelection}
        />
      )}
    </>
  );
}
