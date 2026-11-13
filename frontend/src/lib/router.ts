import { useSyncExternalStore, useCallback } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return window.location.pathname;
}

function notify() {
  listeners.forEach((l) => l());
}

window.addEventListener("popstate", notify);

export function useRouter() {
  const path = useSyncExternalStore(subscribe, getSnapshot);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    notify();
  }, []);

  return { path, navigate };
}
