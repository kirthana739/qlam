"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        className="h-9 w-9 text-muted-foreground"
      >
        <span className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform rotate-0" />
      ) : (
        <Moon className="h-4 w-4 transition-transform rotate-0" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
