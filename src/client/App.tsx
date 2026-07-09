import { useEffect, useState } from "react";

export default function App() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<{ ok: boolean }>)
      .then((d) => setHealthy(d.ok))
      .catch(() => setHealthy(false));
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-stone-950 text-stone-100">
      <h1 className="text-3xl font-semibold tracking-tight">Shared Gallery</h1>
      <p className="text-stone-400">
        {healthy === null ? "Checking…" : healthy ? "API is up" : "API unreachable"}
      </p>
    </div>
  );
}
