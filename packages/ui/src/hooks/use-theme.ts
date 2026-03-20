import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "cortask-theme";
type Theme = "light" | "dark";

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

let currentTheme: Theme = getTheme();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Theme {
  return currentTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = useCallback(() => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, currentTheme);
    applyTheme(currentTheme);
    for (const cb of listeners) cb();
  }, []);

  return { theme, toggle };
}

// Apply saved theme immediately (prevents flash)
applyTheme(currentTheme);
