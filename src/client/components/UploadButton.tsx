import { useRef, useState, type ReactNode } from "react";
import { uploadImage } from "../lib/api";
import { emit } from "../lib/events";
import { getStoredDisplayName } from "../lib/user";
import DisplayNamePrompt from "./DisplayNamePrompt";

export interface UploadItem {
  key: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  retry?: () => void;
}

/**
 * Multi-file upload control. `accept="image/*"` opens the photo library
 * with multi-select; `withCameraSheet` adds an action sheet offering direct
 * camera capture (`capture="environment"`) on mobile. Uploads report
 * per-file progress through onItems (rendered by UploadTray).
 */
export default function UploadButton({
  onItems,
  className,
  withCameraSheet = false,
  children,
}: {
  onItems: (update: (prev: UploadItem[]) => UploadItem[]) => void;
  className?: string;
  withCameraSheet?: boolean;
  children: ReactNode;
}) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function startUpload(files: File[]) {
    for (const file of files) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const run = () => {
        onItems((prev) => [
          ...prev.filter((i) => i.key !== key),
          { key, name: file.name, progress: 0, status: "uploading" },
        ]);
        uploadImage(file, (fraction) => {
          onItems((prev) =>
            prev.map((i) => (i.key === key ? { ...i, progress: fraction } : i)),
          );
        })
          .then(() => {
            onItems((prev) =>
              prev.map((i) => (i.key === key ? { ...i, progress: 1, status: "done" } : i)),
            );
            emit("images-changed");
          })
          .catch((err: unknown) => {
            const offline = !navigator.onLine;
            onItems((prev) =>
              prev.map((i) =>
                i.key === key
                  ? {
                      ...i,
                      status: "error",
                      error: offline
                        ? "You're offline — uploads need a connection"
                        : err instanceof Error
                          ? err.message
                          : "Upload failed",
                      retry: run,
                    }
                  : i,
              ),
            );
          });
      };
      run();
    }
  }

  function onFilesChosen(files: File[]) {
    if (files.length === 0) return;
    // Attribution must be set before the first upload (PRD section 6).
    if (!getStoredDisplayName()) {
      setPendingFiles(files);
      return;
    }
    startUpload(files);
  }

  const inputProps = {
    className: "hidden",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilesChosen(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
  };

  return (
    <>
      <input ref={libraryRef} type="file" accept="image/*" multiple {...inputProps} />
      {withCameraSheet && (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" {...inputProps} />
      )}
      <button
        type="button"
        onClick={() => (withCameraSheet ? setSheetOpen(true) : libraryRef.current?.click())}
        className={className}
      >
        {children}
      </button>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Add photos"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-b-0 border-stone-800 bg-stone-900 p-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <button
              onClick={() => {
                setSheetOpen(false);
                libraryRef.current?.click();
              }}
              className="block w-full min-h-12 rounded-xl px-4 text-left text-base text-stone-100 hover:bg-stone-800"
            >
              🖼️ Choose from library
            </button>
            <button
              onClick={() => {
                setSheetOpen(false);
                cameraRef.current?.click();
              }}
              className="block w-full min-h-12 rounded-xl px-4 text-left text-base text-stone-100 hover:bg-stone-800"
            >
              📸 Take a photo
            </button>
            <button
              onClick={() => setSheetOpen(false)}
              className="mt-1 block w-full min-h-12 rounded-xl px-4 text-center text-sm text-stone-400 hover:bg-stone-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingFiles && (
        <DisplayNamePrompt
          allowSkip={false}
          onDone={(name) => {
            const files = pendingFiles;
            setPendingFiles(null);
            if (name && files) startUpload(files);
          }}
        />
      )}
    </>
  );
}
