import { useState, type FormEvent } from "react";
import { ApiError, login } from "../lib/api";
import BzwrdCredit from "../components/BzwrdCredit";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || password.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect password. Try again.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else {
        setError("Could not reach the gallery. Check your connection.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative flex min-h-full flex-col items-center justify-center bg-stone-950 px-6 text-stone-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Shared Gallery</h1>
          <p className="mt-1 text-sm text-stone-400">Enter the shared password to continue</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="password" className="sr-only">
            Shared password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Shared password"
            className="min-h-12 rounded-xl border border-stone-700 bg-stone-900 px-4 text-base outline-none placeholder:text-stone-500 focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="min-h-12 rounded-xl bg-amber-400 font-medium text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock gallery"}
          </button>
          {error && (
            <p role="alert" className="text-center text-sm text-rose-400">
              {error}
            </p>
          )}
        </form>
      </div>
      <div className="absolute bottom-6">
        <BzwrdCredit />
      </div>
    </div>
  );
}
