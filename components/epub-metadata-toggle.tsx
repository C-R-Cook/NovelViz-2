"use client";

import { Lock, Unlock } from "lucide-react";

/**
 * “Unlocked” ↔ `applyEpubMetadata === true` when passed to ingest APIs.
 * Locked = keep manual fields; unlocked = overwrite from EPUB on upload.
 */
export function EpubMetadataToggle({
  unlocked,
  onChange,
  disabled,
  id = "epub-metadata-toggle",
  showLabel = true,
  className,
}: {
  unlocked: boolean;
  onChange: (nextUnlocked: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** When false, hides the “EPUB metadata” section heading (e.g. inline on create-book). */
  showLabel?: boolean;
  className?: string;
}) {
  const lockedTitle =
    "Title, author, description, genre, and year will not be replaced when you upload an EPUB";
  const unlockedTitle =
    "Title, author, description, genre, and year will be filled from the EPUB when you upload";

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      {showLabel ? (
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          EPUB metadata
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-pressed={unlocked}
        title={unlocked ? unlockedTitle : lockedTitle}
        onClick={() => onChange(!unlocked)}
        className={`flex ${showLabel ? "w-full" : "min-h-[2.25rem] flex-1"} items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          unlocked
            ? "border-accent/40 bg-accent-muted/35 text-text-primary"
            : "border-border bg-bg-raised text-text-primary"
        }`}
      >
        <span className="shrink-0 text-text-muted" aria-hidden>
          {unlocked ? (
            <Unlock className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : (
            <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1 font-medium text-text-primary">
          {unlocked ? "Get book details from EPUB" : "Keep book details as entered"}
        </span>
      </button>
    </div>
  );
}
