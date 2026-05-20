"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "mise" | "pantry" | "hearth";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "hearth", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("hearth");

  useEffect(() => {
    const saved = (localStorage.getItem("chef-theme") as Theme) || "hearth";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("chef-theme", t);
    document.documentElement.setAttribute("data-theme", t);
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
