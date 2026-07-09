import { useEffect, useState } from "react";
import Login from "./views/Login";
import DisplayNamePrompt from "./components/DisplayNamePrompt";
import { bootSession, type AuthState } from "./lib/session";
import { getStoredDisplayName } from "./lib/user";
import { logout } from "./lib/api";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [namePromptDone, setNamePromptDone] = useState(() => getStoredDisplayName() !== null);

  useEffect(() => {
    void bootSession(() => setAuth("login")).then(setAuth);
  }, []);

  if (auth === "checking") {
    return (
      <div className="flex h-full items-center justify-center bg-stone-950">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-700 border-t-amber-400"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (auth === "login") {
    return <Login onSuccess={() => setAuth("authed")} />;
  }

  return (
    <div className="flex h-full flex-col bg-stone-950 text-stone-100">
      <header className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Shared Gallery</h1>
        <button
          onClick={() => {
            void logout().finally(() => setAuth("login"));
          }}
          className="min-h-11 rounded-lg px-3 text-sm text-stone-400 hover:text-stone-200"
        >
          Log out
        </button>
      </header>
      <main className="flex flex-1 items-center justify-center text-stone-500">
        Gallery views arrive in the next phases.
      </main>
      {!namePromptDone && <DisplayNamePrompt onDone={() => setNamePromptDone(true)} />}
    </div>
  );
}
