/**
 * App colour themes (maps to `data-theme` on `<html>`).
 * - `candle-light` — default “dark” experience
 * - `aged-parchment` — “light” experience
 *
 * UI to toggle is not shipped yet; use `setAppColorScheme` / `persistTheme` + `applyTheme`
 * when you add a light/dark control.
 */

export const THEME_IDS = ["candle-light", "aged-parchment"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ColorScheme = "dark" | "light";

const STORAGE_KEY = "nv_theme";

/** @deprecated read only for one-time migration */
const LEGACY_DEV_PALETTE_KEY = "dev_palette";

const LEGACY_DARK_THEME_IDS = new Set<string>([
  "moonlight-silver",
  "deep-ocean",
  "forest-dusk",
  "antiquarian",
  "midnight",
  "moonlight",
  "gothic",
  "crimson",
  "candlelight",
]);

export function normalizeThemeId(raw: string | null | undefined): ThemeId {
  if (!raw) return "candle-light";
  if (raw === "aged-parchment") return "aged-parchment";
  if (raw === "candle-light") return "candle-light";
  if (LEGACY_DARK_THEME_IDS.has(raw)) return "candle-light";
  return "candle-light";
}

export function colorSchemeToThemeId(scheme: ColorScheme): ThemeId {
  return scheme === "light" ? "aged-parchment" : "candle-light";
}

export function themeIdToColorScheme(id: ThemeId): ColorScheme {
  return id === "aged-parchment" ? "light" : "dark";
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

export function persistTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** When a light/dark toggle exists, call this. */
export function setAppColorScheme(scheme: ColorScheme): void {
  const id = colorSchemeToThemeId(scheme);
  persistTheme(id);
  applyTheme(id);
}

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "candle-light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (THEME_IDS as readonly string[]).includes(stored)) {
      return stored as ThemeId;
    }
    if (stored) {
      const fixed = normalizeThemeId(stored);
      localStorage.setItem(STORAGE_KEY, fixed);
      return fixed;
    }
    const legacy = localStorage.getItem(LEGACY_DEV_PALETTE_KEY);
    const migrated = normalizeThemeId(legacy);
    localStorage.setItem(STORAGE_KEY, migrated);
    return migrated;
  } catch {
    return "candle-light";
  }
}
