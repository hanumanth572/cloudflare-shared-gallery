import { useCallback, useState, type ReactNode } from "react";
import type { Route } from "../lib/router";
import { enqueueUploads, type UploadBatch } from "../lib/uploadQueue";
import BatchTagPrompt from "./BatchTagPrompt";
import { getStoredDisplayName } from "../lib/user";
import ViewSwitcher from "./ViewSwitcher";
import SettingsMenu from "./SettingsMenu";
import UploadButton from "./UploadButton";
import UploadTray from "./UploadTray";
import OfflineBanner from "./OfflineBanner";
import DropZone from "./DropZone";
import DisplayNamePrompt from "./DisplayNamePrompt";
import BzwrdCredit from "./BzwrdCredit";
import { IconPlus } from "./icons";

/**
 * App chrome: compact top bar plus bottom navigation on mobile, single top
 * bar on desktop. Files can arrive from the upload buttons, the camera
 * sheet, or a drag-and-drop anywhere on the page — all funnel through
 * handleFiles, which enforces the display-name-before-first-upload rule and
 * feeds the shared, concurrency-limited upload queue.
 */
export default function Shell({
  route,
  onNavigate,
  onLoggedOut,
  children,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
  onLoggedOut: () => void;
  children: ReactNode;
}) {
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [tagPrompt, setTagPrompt] = useState<UploadBatch | null>(null);

  const startUpload = useCallback((images: File[]) => {
    const batch = enqueueUploads(images);
    // Multi-file uploads offer batch filing into a collection.
    if (images.length >= 2) setTagPrompt(batch);
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      // Attribution must be set before the first upload (PRD section 6).
      if (!getStoredDisplayName()) {
        setPendingFiles(images);
        return;
      }
      startUpload(images);
    },
    [startUpload],
  );

  return (
    <div className="flex min-h-full flex-col bg-stone-950 text-stone-100">
      <header
        className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <button
            onClick={() => onNavigate({ name: "root" })}
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
            aria-label="Go home"
          >
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            Shared<span className="-ml-1 text-amber-400">Gallery</span>
          </button>
          <div className="hidden sm:block">
            <ViewSwitcher route={route} onNavigate={onNavigate} orientation="top" />
          </div>
          <div className="flex items-center gap-1">
            <UploadButton
              onFiles={handleFiles}
              className="hidden min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-medium text-stone-950 hover:bg-amber-300 sm:flex"
            >
              <IconPlus width="0.9em" height="0.9em" /> Upload
            </UploadButton>
            <SettingsMenu onLoggedOut={onLoggedOut} />
          </div>
        </div>
        <OfflineBanner />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-3 sm:px-4">
        {children}
      </main>

      <footer className="mx-auto flex w-full max-w-7xl justify-center px-4 pb-28 pt-12 sm:pb-8">
        <BzwrdCredit />
      </footer>

      {/* Mobile bottom navigation */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-800/80 bg-stone-950/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-3 py-1.5">
          <ViewSwitcher route={route} onNavigate={onNavigate} orientation="bottom" />
          <UploadButton
            onFiles={handleFiles}
            withCameraSheet
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-bold text-stone-950 shadow-lg hover:bg-amber-300"
          >
            <IconPlus />
            <span className="sr-only">Upload photos</span>
          </UploadButton>
        </div>
      </div>

      <DropZone onFiles={handleFiles} />
      <UploadTray />

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

      {tagPrompt && <BatchTagPrompt batch={tagPrompt} onClose={() => setTagPrompt(null)} />}
    </div>
  );
}
