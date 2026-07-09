import { useEffect, useState } from "react";
import Login from "./views/Login";
import AllImages from "./views/AllImages";
import DisplayNamePrompt from "./components/DisplayNamePrompt";
import Shell from "./components/Shell";
import { bootSession, type AuthState } from "./lib/session";
import { getStoredDisplayName } from "./lib/user";
import { useRoute } from "./lib/router";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [namePromptDone, setNamePromptDone] = useState(() => getStoredDisplayName() !== null);
  const [route, navigate] = useRoute();

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
    <Shell route={route} onNavigate={navigate} onLoggedOut={() => setAuth("login")}>
      {route.name === "photos" && <AllImages />}
      {route.name === "root" && <AllImages />}
      {(route.name === "collections" || route.name === "collection") && (
        <p className="py-20 text-center text-stone-500">Collections arrive in the next phase.</p>
      )}
      {!namePromptDone && <DisplayNamePrompt onDone={() => setNamePromptDone(true)} />}
    </Shell>
  );
}
