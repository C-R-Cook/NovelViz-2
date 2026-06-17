"use client";

import { HelpCircle } from "lucide-react";

type Props = {
  label: string;
  tooltip: string;
};

/** Stat label with a ? icon that reveals an explanation on hover or keyboard focus. */
export function PartnerStatLabelWithHelp({ label, tooltip }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          className="inline-flex rounded-sm text-text-muted transition hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label={tooltip}
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-border bg-bg-raised px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {tooltip}
        </span>
      </span>
    </span>
  );
}
