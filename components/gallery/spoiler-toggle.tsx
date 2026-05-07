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
    "inline-flex cursor-pointer flex-col items-start gap-0.5 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
  let title: string;
  let sub: string | null = null;

  if (currentSetting === "UNLOCKED") {
    pillClass += " border-success/35 bg-success/10 text-success";
    title = "Showing everything";
  } else if (currentSetting === "PROTECTED") {
    pillClass += " border-error/35 bg-error/10 text-error";
    title = "Spoilers hidden";
  } else {
    pillClass += " border-border bg-bg-base/80 text-text-secondary";
    title = "Following global setting";
    sub = effectiveHidden ? "Effective: spoilers hidden" : "Effective: showing everything";
  }

  return (
    <button type="button" className={pillClass} disabled={pending} onClick={() => void cycle()} aria-busy={pending}>
      <span>{title}</span>
      {sub ? <span className="max-w-[14rem] text-[10px] font-normal leading-tight text-text-muted">{sub}</span> : null}
    </button>
  );
}
