import { useEffect, useRef, useState } from "react";
import { logout } from "../lib/api";
import { navigateTo } from "../lib/router";
import { getStoredDisplayName } from "../lib/user";
import DisplayNamePrompt from "./DisplayNamePrompt";
import { IconGear } from "./icons";

/** Small settings control: change display name, log out. */
export default function SettingsMenu({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const name = getStoredDisplayName();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-stone-400 hover:bg-stone-900 hover:text-stone-200"
      >
        <IconGear />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-stone-800 bg-stone-900 p-1.5 shadow-xl">
          <div className="px-3 py-2 text-xs text-stone-500">
            {name ? (
              <>
                Signed in as <span className="font-medium text-stone-300">{name}</span>
              </>
            ) : (
              "No display name set"
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setEditingName(true);
            }}
            className="block w-full min-h-11 rounded-lg px-3 text-left text-sm text-stone-200 hover:bg-stone-800"
          >
            Change display name
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigateTo({ name: "deleted" });
            }}
            className="block w-full min-h-11 rounded-lg px-3 text-left text-sm text-stone-200 hover:bg-stone-800"
          >
            Recently deleted
          </button>
          <button
            onClick={() => {
              void logout().finally(onLoggedOut);
            }}
            className="block w-full min-h-11 rounded-lg px-3 text-left text-sm text-stone-200 hover:bg-stone-800"
          >
            Log out
          </button>
        </div>
      )}
      {editingName && (
        <DisplayNamePrompt initialName={name ?? ""} onDone={() => setEditingName(false)} />
      )}
    </div>
  );
}
