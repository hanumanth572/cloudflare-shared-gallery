import { useState, type FormEvent } from "react";
import { storeDisplayName } from "../lib/user";

/**
 * First-run prompt for the self-declared display name. Not authentication —
 * a soft label so the gallery can show who uploaded or tagged something.
 */
export default function DisplayNamePrompt({
  initialName = "",
  allowSkip = true,
  onDone,
}: {
  initialName?: string;
  allowSkip?: boolean;
  onDone: (name: string | null) => void;
}) {
  const [name, setName] = useState(initialName);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    storeDisplayName(trimmed);
    onDone(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-2xl"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <h2 id="name-prompt-title" className="text-lg font-semibold text-stone-100">
          What should we call you?
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          Your name is shown next to photos you upload and tag. You can change it later in
          settings.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Jonno"
          aria-label="Display name"
          className="mt-4 w-full min-h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-400"
        />
        <div className="mt-4 flex items-center justify-end gap-3">
          {allowSkip && (
            <button
              type="button"
              onClick={() => onDone(null)}
              className="min-h-11 rounded-lg px-3 text-sm text-stone-400 hover:text-stone-200"
            >
              Skip for now
            </button>
          )}
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="min-h-11 rounded-xl bg-amber-400 px-5 font-medium text-stone-950 hover:bg-amber-300 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
