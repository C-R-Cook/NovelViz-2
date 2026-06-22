"use client";

import { applyTheme, readStoredTheme } from "@/lib/theme-preference";
import { useEffect } from "react";

/** Keeps the marketing landing page on candle-light without overwriting the user's saved preference. */
export function LandingThemeLock() {
  useEffect(() => {
    applyTheme("candle-light");
    return () => {
      applyTheme(readStoredTheme());
    };
  }, []);

  return null;
}
