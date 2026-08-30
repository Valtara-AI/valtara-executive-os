// FR-DB-06: "User preference stored; applies system-wide immediately."
// Persisted to localStorage (not a DB column - this is a client display
// preference, not domain data) and applied via the `data-theme` attribute
// globals.css already keys its dark-palette overrides off.

import { create } from "zustand";

export type Theme = "light" | "dark";

// Exported so layout.tsx's blocking inline theme-flash-prevention script
// (Phase A) reads the same key rather than defining it a second time.
export const STORAGE_KEY = "nyxor-theme";

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  initTheme: () => {
    const theme = getInitialTheme();
    applyThemeToDocument(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, next);
    applyThemeToDocument(next);
    set({ theme: next });
  },
}));
