"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  type ThemeId,
} from "@/lib/theme-preference";

const THEME_A: ThemeId = "candle-light";
const THEME_B: ThemeId = "moonlight-silver";

/** Crescent moon — shown when on candle-light (click → switch to moonlight-silver) */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.75}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  );
}

/** Candle flame — shown when on moonlight-silver (click → switch to candle-light) */
function CandleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.75}
      stroke="currentColor"
      aria-hidden
    >
      {/* flame */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c0 2-2.5 3.5-2.5 5.5a2.5 2.5 0 005 0C14.5 6.5 12 5 12 3z"
      />
      {/* wick + body */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 15v4a1 1 0 001 1h6a1 1 0 001-1v-4" />
    </svg>
  );
}

/**
 * Two-position theme toggle: candle-light ↔ moonlight-silver.
 * Reads the active theme from the DOM (already set by the hydration script before paint),
 * so there is no flash-of-wrong-icon. An invisible placeholder is rendered before mount
 * to prevent layout shift.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(THEME_A);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // The hydration script has already applied the correct data-theme before paint.
    const domTheme = document.documentElement.getAttribute("data-theme") as ThemeId | null;
    setTheme(domTheme === THEME_B ? THEME_B : THEME_A);
    setMounted(true);
  }, []);

  function toggle() {
    const next: ThemeId = theme === THEME_A ? THEME_B : THEME_A;
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  }

  const isMoonlight = theme === THEME_B;
  const label = isMoonlight ? "Switch to Candle Light theme" : "Switch to Moonlight Silver theme";

  // Before mount: invisible placeholder keeps the layout stable
  if (!mounted) {
    return (
      <div
        className="h-9 w-9 shrink-0"
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      id="theme-switcher"
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface/80 text-text-muted shadow-inner transition hover:bg-bg-raised hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label={label}
      title={label}
    >
      {isMoonlight ? (
        <CandleIcon className="h-4 w-4" />
      ) : (
        <MoonIcon className="h-4 w-4" />
      )}
    </button>
  );
}
