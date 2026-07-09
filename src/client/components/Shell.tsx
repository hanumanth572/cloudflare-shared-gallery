import { useState, type ReactNode } from "react";
import type { Route } from "../lib/router";
import ViewSwitcher from "./ViewSwitcher";
import SettingsMenu from "./SettingsMenu";
import UploadButton, { type UploadItem } from "./UploadButton";
import UploadTray from "./UploadTray";

/**
 * App chrome: compact top bar plus bottom navigation on mobile, single top
 * bar on desktop. Content scrolls under the fixed bars; safe areas padded.
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
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  return (
    <div className="flex min-h-full flex-col bg-stone-950 text-stone-100">
      <header
        className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <button
            onClick={() => onNavigate({ name: "root" })}
            className="text-lg font-semibold tracking-tight"
            aria-label="Go home"
          >
            Shared<span className="text-amber-400"> Gallery</span>
          </button>
          <div className="hidden sm:block">
            <ViewSwitcher route={route} onNavigate={onNavigate} orientation="top" />
          </div>
          <div className="flex items-center gap-1">
            <UploadButton
              onItems={setUploads}
              className="hidden min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-medium text-stone-950 hover:bg-amber-300 sm:flex"
            >
              <span aria-hidden>＋</span> Upload
            </UploadButton>
            <SettingsMenu onLoggedOut={onLoggedOut} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-28 pt-3 sm:px-4 sm:pb-8">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-800/80 bg-stone-950/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-3 py-1.5">
          <ViewSwitcher route={route} onNavigate={onNavigate} orientation="bottom" />
          <UploadButton
            onItems={setUploads}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-bold text-stone-950 shadow-lg hover:bg-amber-300"
          >
            <span aria-hidden>＋</span>
            <span className="sr-only">Upload photos</span>
          </UploadButton>
        </div>
      </div>

      <UploadTray items={uploads} onItems={setUploads} />
    </div>
  );
}
