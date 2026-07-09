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
 * Multi-file upload control. `accept="image/*"` offers both camera capture
 * and the photo library on mobile. Uploads run sequentially with per-file
 * progress reported through onItems (rendered by UploadTray).
 */
export default function UploadButton({
  onItems,
  className,
  children,
}: {
  onItems: (update: (prev: UploadItem[]) => UploadItem[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

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
            onItems((prev) =>
              prev.map((i) =>
                i.key === key
                  ? {
                      ...i,
                      status: "error",
                      error: err instanceof Error ? err.message : "Upload failed",
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFilesChosen(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} className={className}>
        {children}
      </button>
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
