"use client";

import { Lock } from "lucide-react";

type Props = {
  /** Server hint: `"Spoiler under review"` vs any other locked spoiler message. */
  lockMessage: string;
};

function lockCopy(lockMessage: string): [string, string] {
  if (lockMessage === "Spoiler under review") {
    return ["Spoiler under review", "Hidden until moderation finishes"];
  }
  return ["Spoiler locked", "Read further in the book to view"];
}

export function CommentSpoilerLockOverlay({ lockMessage }: Props) {
  const [title, subtitle] = lockCopy(lockMessage);

  return (
    <div
      className="mt-2 flex items-center gap-2.5 rounded-md border border-border/60 bg-bg-base/40 px-2.5 py-2"
      role="status"
    >
      <Lock className="h-5 w-5 shrink-0 text-accent-text/90" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 leading-snug">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
