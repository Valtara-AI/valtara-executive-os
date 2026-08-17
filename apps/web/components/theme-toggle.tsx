"use client";

import * as React from "react";
import { useThemeStore } from "@/store/theme-store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme, initTheme } = useThemeStore();

  React.useEffect(() => {
    initTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? "Dark mode" : "Light mode"}
    </Button>
  );
}
