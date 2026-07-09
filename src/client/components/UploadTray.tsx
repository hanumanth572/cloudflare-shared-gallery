import { useEffect } from "react";
import type { UploadItem } from "./UploadButton";

/** Per-file upload progress, floating above the bottom nav. */
export default function UploadTray({
  items,
  onItems,
}: {
  items: UploadItem[];
  onItems: (update: (prev: UploadItem[]) => UploadItem[]) => void;
}) {
  // Completed uploads fade out after a moment; errors stay until dismissed.
  useEffect(() => {
    if (!items.some((i) => i.status === "done")) return;
    const t = setTimeout(() => {
      onItems((prev) => prev.filter((i) => i.status !== "done"));
    }, 2500);
    return () => clearTimeout(t);
  }, [items, onItems]);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-40 flex flex-col gap-2 sm:left-auto sm:w-80"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="pointer-events-auto rounded-xl border border-stone-800 bg-stone-900/95 px-3 py-2 shadow-lg backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-stone-300">{item.name}</span>
            {item.status === "uploading" && (
              <span className="text-xs tabular-nums text-stone-500">
                {Math.round(item.progress * 100)}%
              </span>
            )}
            {item.status === "done" && <span className="text-xs text-emerald-400">Uploaded</span>}
            {item.status === "error" && (
              <span className="flex items-center gap-2">
                <button
                  onClick={item.retry}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300"
                >
                  Retry
                </button>
                <button
                  onClick={() => onItems((prev) => prev.filter((i) => i.key !== item.key))}
                  aria-label={`Dismiss failed upload ${item.name}`}
                  className="text-xs text-stone-500 hover:text-stone-300"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          {item.status === "error" ? (
            <p className="mt-1 text-xs text-rose-400">{item.error}</p>
          ) : (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-800">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  item.status === "done" ? "bg-emerald-400" : "bg-amber-400"
                }`}
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
