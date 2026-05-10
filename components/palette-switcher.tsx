"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dev_palette";

export const THEME_IDS = [
  "moonlight-silver",
  "candle-light",
  "deep-ocean",
  "aged-parchment",
  "forest-dusk",
  "antiquarian",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

const THEME_LABELS: Record<ThemeId, string> = {
  "moonlight-silver": "Moonlight Silver",
  "candle-light": "Candle Light",
  "deep-ocean": "Deep Ocean",
  "aged-parchment": "Aged Parchment",
  "forest-dusk": "Forest at Dusk",
  antiquarian: "Antiquarian",
};

function readStoredThemeId(): ThemeId {
  if (typeof window === "undefined") return "moonlight-silver";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (THEME_IDS as readonly string[]).includes(raw)) return raw as ThemeId;
    const migrate: Record<string, ThemeId> = {
      midnight: "moonlight-silver",
      gothic: "forest-dusk",
      candlelight: "candle-light",
      moonlight: "moonlight-silver",
      crimson: "antiquarian",
    };
    if (raw && migrate[raw]) return migrate[raw];
  } catch {
    /* ignore */
  }
  return "moonlight-silver";
}

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
}

export function PaletteSwitcher() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <PaletteSwitcherInner />;
}

function PaletteSwitcherInner() {
  const [themeId, setThemeId] = useState<ThemeId>("moonlight-silver");

  useEffect(() => {
    const id = readStoredThemeId();
    setThemeId(id);
    applyTheme(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const onChange = useCallback((id: ThemeId) => {
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyTheme(id);
  }, []);

  return (
    <label className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="hidden text-[10px] font-medium uppercase tracking-wide text-text-muted sm:inline">
        Theme
      </span>
      <select
        aria-label="Development colour theme"
        value={themeId}
        onChange={(e) => {
          const v = e.target.value as ThemeId;
          if ((THEME_IDS as readonly string[]).includes(v)) onChange(v);
        }}
        className="min-w-[12rem] cursor-pointer rounded-lg border border-border bg-bg-raised px-2 py-1.5 text-xs font-medium text-text-primary shadow-inner outline-none ring-accent/30 transition focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {THEME_IDS.map((id) => (
          <option key={id} value={id}>
            {THEME_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
