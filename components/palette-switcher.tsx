"use client";

/**
 * Theme picker is intentionally not shown while product decides on light/dark UX.
 * Import `setAppColorScheme`, `readStoredTheme`, `applyTheme` from `@/lib/theme-preference` for a future toggle.
 */

export { THEME_IDS, type ThemeId, type ColorScheme, setAppColorScheme, readStoredTheme, applyTheme, persistTheme } from "@/lib/theme-preference";

export function PaletteSwitcher() {
  return null;
}
