import { useCallback, useEffect, useState } from "react";

/** Client routes: Home, Photos, Collections, one collection, one person. */
export type Route =
  | { name: "root" }
  | { name: "photos" }
  | { name: "collections" }
  | { name: "collection"; id: string }
  | { name: "uploader"; who: string };

export function parsePath(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "photos") return { name: "photos" };
  if (parts[0] === "collections") {
    if (parts[1]) return { name: "collection", id: decodeURIComponent(parts[1]) };
    return { name: "collections" };
  }
  if (parts[0] === "by" && parts[1]) {
    return { name: "uploader", who: decodeURIComponent(parts[1]) };
  }
  return { name: "root" };
}

export function routePath(route: Route): string {
  switch (route.name) {
    case "root":
      return "/";
    case "photos":
      return "/photos";
    case "collections":
      return "/collections";
    case "collection":
      return `/collections/${encodeURIComponent(route.id)}`;
    case "uploader":
      return `/by/${encodeURIComponent(route.who)}`;
  }
}

/**
 * Imperative navigation for deeply nested components (e.g. the lightbox's
 * "Uploaded by" link). Pushes history and pokes every useRoute hook.
 */
export function navigateTo(route: Route): void {
  history.pushState(null, "", routePath(route));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Tiny History-API router hook. */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parsePath(location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parsePath(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: Route) => {
    history.pushState(null, "", routePath(next));
    setRoute(next);
  }, []);

  return [route, navigate];
}
