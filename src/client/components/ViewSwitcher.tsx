import type { Route } from "../lib/router";

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: { name: "root" }, label: "Home", icon: "⌂" },
  { route: { name: "photos" }, label: "Photos", icon: "▦" },
  { route: { name: "collections" }, label: "Collections", icon: "🗂" },
];

function isActive(tab: Route, current: Route): boolean {
  if (tab.name === current.name) return true;
  // A collection detail highlights the Collections tab.
  return tab.name === "collections" && current.name === "collection";
}

/** One-tap switcher between the three view modes. */
export default function ViewSwitcher({
  route,
  onNavigate,
  orientation,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
  orientation: "bottom" | "top";
}) {
  if (orientation === "top") {
    return (
      <nav aria-label="Views" className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = isActive(tab.route, route);
          return (
            <button
              key={tab.label}
              onClick={() => onNavigate(tab.route)}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 rounded-lg px-4 text-sm font-medium transition ${
                active
                  ? "bg-stone-800 text-amber-400"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Views" className="flex flex-1 items-stretch justify-around">
      {TABS.map((tab) => {
        const active = isActive(tab.route, route);
        return (
          <button
            key={tab.label}
            onClick={() => onNavigate(tab.route)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg text-xs ${
              active ? "text-amber-400" : "text-stone-400"
            }`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
