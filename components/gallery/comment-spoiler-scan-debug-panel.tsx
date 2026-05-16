"use client";

import {
  formatSpoilerCheckResultLabel,
  type CommentSpoilerScanDebug,
} from "@/lib/comment-spoiler-scan-debug";

/** Dev-only spoiler scan lines under each gallery comment. Not rendered unless UI flag is on. */
export function CommentSpoilerScanDebugPanel({
  debug,
}: {
  debug: CommentSpoilerScanDebug | null | undefined;
}) {
  return (
    <div className="mt-2 border-t border-dashed border-border pt-2">
      <p className="font-mono text-[11px] leading-snug text-text-muted">
        {formatSpoilerCheckResultLabel(debug)}
      </p>
      {debug?.rawModelText ? (
        <p className="mt-1 break-all font-mono text-[10px] leading-snug text-text-muted/80">
          Model JSON: {debug.rawModelText}
        </p>
      ) : null}
      {debug?.errorMessage ? (
        <p className="mt-1 font-mono text-[10px] text-error">{debug.errorMessage}</p>
      ) : null}
    </div>
  );
}
