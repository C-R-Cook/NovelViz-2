/**
 * App colour themes (maps to `data-theme` on `<html>`).
 * - `candle-light` — warm gold on dark brown (default)
 * - `moonlight-silver` — cool blue on dark blue-grey
 *
 * Toggle UI: `components/theme-switcher.tsx`
 * Use `applyTheme` + `persistTheme` to change themes at runtime.
 */

export const THEME_IDS = ["candle-light", "moonlight-silver"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ColorScheme = "dark" | "light";

const STORAGE_KEY = "nv_theme";

/** @deprecated read only for one-time migration */
const LEGACY_DEV_PALETTE_KEY = "dev_palette";

/**
 * Legacy theme IDs that mapped to candle-light in the old 5-theme system.
 * Keep these so any user with an old `nv_theme` value still gets a valid theme.
 */
const LEGACY_CANDLE_THEME_IDS = new Set<string>([
  "deep-ocean",
  "forest-dusk",
  "antiquarian",
  "midnight",
  "gothic",
  "crimson",
  "candlelight",
]);

/** Legacy IDs that map to aged-parchment → now normalise to candle-light since that theme is removed. */
const LEGACY_AGED_PARCHMENT_IDS = new Set<string>(["aged-parchment"]);

export function normalizeThemeId(raw: string | null | undefined): ThemeId {
  if (!raw) return "candle-light";
  if (raw === "candle-light") return "candle-light";
  if (raw === "moonlight-silver") return "moonlight-silver";
  // aged-parchment was removed — fall back to candle-light
  if (LEGACY_AGED_PARCHMENT_IDS.has(raw)) return "candle-light";
  if (LEGACY_CANDLE_THEME_IDS.has(raw)) return "candle-light";
  return "candle-light";
}

export function colorSchemeToThemeId(scheme: ColorScheme): ThemeId {
  // Both current themes are dark; light scheme falls back to candle-light
  return "candle-light";
}

export function themeIdToColorScheme(id: ThemeId): ColorScheme {
  // Both themes are dark — kept in case callers depend on this
  return "dark";
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
