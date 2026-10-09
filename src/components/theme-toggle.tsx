"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";

import { applyStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Sun/moon switch in the header. The highlighted half follows the `dark` class on <html>
 * through CSS alone, so the server render never disagrees with the saved theme.
 * On phones only the mode you would switch to is shown, to keep the header on one row.
 */
export function ThemeToggle() {
  // React's dev remount clears the class the head script set; put it back before paint.
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  function toggle() {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Light or dark mode"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/12 p-[3px] outline-none hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60"
    >
      <span className="hidden size-[38px] items-center justify-center rounded-full bg-white text-header sm:inline-flex dark:inline-flex dark:bg-transparent dark:text-white sm:dark:text-white/70">
        <Sun className="size-5" aria-hidden />
      </span>
      <span className="inline-flex size-[38px] items-center justify-center rounded-full text-white sm:text-white/70 dark:hidden dark:bg-status-some sm:dark:inline-flex sm:dark:text-white">
        <Moon className="size-5" aria-hidden />
      </span>
    </button>
  );
}
