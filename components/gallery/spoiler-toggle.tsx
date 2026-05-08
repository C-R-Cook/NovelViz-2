"use client";

import type { SpoilerProtection } from "@db";
import { useState } from "react";

const ORDER: SpoilerProtection[] = ["INHERIT", "PROTECTED", "UNLOCKED"];

export type SpoilerToggleProps = {
  bookId: string;
  currentSetting: SpoilerProtection;
  globalSetting: boolean;
  onUpdate: (next: SpoilerProtection) => void;
};

export function SpoilerToggle({ bookId, currentSetting, globalSetting, onUpdate }: SpoilerToggleProps) {
  const [pending, setPending] = useState(false);

  async function cycle() {
    const idx = ORDER.indexOf(currentSetting);
    const next = ORDER[(idx + 1) % ORDER.length];
    setPending(true);
    try {
      const res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: next }),
      });
      if (!res.ok) return;
      onUpdate(next);
    } finally {
      setPending(false);
    }
  }

  const effectiveHidden = currentSetting === "PROTECTED" || (currentSetting === "INHERIT" && globalSetting);

  let pillClass =
    "inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
  const title = effectiveHidden ? "Show everything" : "Hide spoilers";

  if (effectiveHidden) {
    pillClass += " border-error/35 bg-error/10 text-error";
  } else {
    pillClass += " border-success/35 bg-success/10 text-success";
  }

  return (
    <button type="button" className={pillClass} disabled={pending} onClick={() => void cycle()} aria-busy={pending}>
      {title}
    </button>
  );
}
