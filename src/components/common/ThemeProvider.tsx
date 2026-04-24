"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "light", setTheme: () => {} });

const THEME_STORAGE_KEY = "career-ops-theme";
const THEME_EVENT = "career-ops:theme-change";

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();

  window.addEventListener(THEME_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(THEME_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readTheme, () => "light");

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }

    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function setTheme(next: Theme) {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
