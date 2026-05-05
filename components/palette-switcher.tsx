"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dev_palette";

const PALETTE_CLASSES = [
  "",
  "palette-gothic",
  "palette-candlelight",
  "palette-moonlight",
  "palette-crimson",
] as const;

const PALETTE_IDS = ["midnight", "gothic", "candlelight", "moonlight", "crimson"] as const;

type PaletteId = (typeof PALETTE_IDS)[number];

function idToBodyClass(id: PaletteId): string {
  const i = PALETTE_IDS.indexOf(id);
  return PALETTE_CLASSES[i] ?? "";
}

function readStoredId(): PaletteId {
  if (typeof window === "undefined") return "midnight";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && PALETTE_IDS.includes(raw as PaletteId)) return raw as PaletteId;
  } catch {
    /* ignore */
  }
  return "midnight";
}

function applyPaletteToBody(id: PaletteId) {
  const body = document.body;
  for (const c of PALETTE_CLASSES) {
    if (c) body.classList.remove(c);
  }
  const cls = idToBodyClass(id);
  if (cls) body.classList.add(cls);
}

export function PaletteSwitcher() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <PaletteSwitcherInner />;
}

function PaletteSwitcherInner() {
  const [paletteId, setPaletteId] = useState<PaletteId>("midnight");

  useEffect(() => {
    const id = readStoredId();
    setPaletteId(id);
    applyPaletteToBody(id);
  }, []);

  const onChange = useCallback((id: PaletteId) => {
    setPaletteId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyPaletteToBody(id);
  }, []);

  return (
    <label className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="hidden text-[10px] font-medium uppercase tracking-wide text-text-muted sm:inline">
        Palette
      </span>
      <select
        aria-label="Development colour palette"
        value={paletteId}
        onChange={(e) => {
          const v = e.target.value as PaletteId;
          if (PALETTE_IDS.includes(v)) onChange(v);
        }}
        className="min-w-[10.5rem] cursor-pointer rounded-lg border border-border bg-bg-raised px-2 py-1.5 text-xs font-medium text-text-primary shadow-inner outline-none ring-accent/30 transition focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <option value="midnight">Midnight Library</option>
        <option value="gothic">Gothic Noir</option>
        <option value="candlelight">Candlelight</option>
        <option value="moonlight">Moonlight Silver</option>
        <option value="crimson">Crimson</option>
      </select>
    </label>
  );
}
