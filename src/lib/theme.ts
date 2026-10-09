/** Light/dark theme. The choice lives in localStorage; with none saved, the device setting wins. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint so a saved dark theme never flashes light.
 * Keep in sync with `applyStoredTheme` below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function applyStoredTheme() {
  let dark = false;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {}
  document.documentElement.classList.toggle("dark", dark);
}
