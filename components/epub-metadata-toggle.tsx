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
}: {
  unlocked: boolean;
  onChange: (nextUnlocked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const lockedTitle =
    "Metadata fields will not be overwritten when you upload or change the EPUB file";
  const unlockedTitle =
    "Title, author, description, genre, and published year will be filled from the EPUB file when uploaded";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">EPUB metadata</span>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-pressed={unlocked}
        title={unlocked ? unlockedTitle : lockedTitle}
        onClick={() => onChange(!unlocked)}
        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          unlocked
            ? "border-accent/40 bg-accent-muted/35 text-text-primary"
            : "border-border bg-bg-raised text-text-primary"
        }`}
      >
        <span className="mt-0.5 shrink-0 text-text-muted" aria-hidden>
          {unlocked ? (
            <Unlock className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : (
            <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-text-primary">
            {unlocked ? "Unlocked — Pull metadata from EPUB" : "Locked — Keep existing metadata"}
          </span>
          <span className="mt-1 block text-xs leading-snug text-text-secondary">
            {unlocked ? unlockedTitle : lockedTitle}
          </span>
        </span>
      </button>
    </div>
  );
}
