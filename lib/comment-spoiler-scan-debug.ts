/** Persisted on Comment.spoilerScanDebug while testing spoiler moderation. */
export type CommentSpoilerScanOutcome =
  | "pending"
  | "safe"
  | "flagged"
  | "unparseable"
  | "scan_failed"
  | "skipped";

export type CommentSpoilerScanDebug = {
  outcome: CommentSpoilerScanOutcome;
  imageChapter: number;
  bookTitle: string;
  /** Raw assistant message (expected JSON). */
  rawModelText?: string;
  parsedIsSpoiler?: boolean | null;
  /** Optional when the model returns spoilerChapter. */
  spoilerChapter?: number | null;
  scannedAt: string;
  errorMessage?: string;
};

export function isCommentSpoilerScanDebugEnabled(): boolean {
  const raw = process.env.COMMENT_SCAN_DEBUG;
  if (raw === "0" || raw?.toLowerCase() === "false") return false;
  if (raw === "1" || raw?.toLowerCase() === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/** Per-comment debug lines in the gallery UI. Off by default; set NEXT_PUBLIC_COMMENT_SCAN_DEBUG_UI=1 to show. */
export function isCommentSpoilerScanDebugUiEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_COMMENT_SCAN_DEBUG_UI;
  return raw === "1" || raw?.toLowerCase() === "true";
}

/** Await scan in-request (easier local testing). Set COMMENT_SCAN_SYNC=1 to force in production. */
export function shouldAwaitCommentSpoilerScan(): boolean {
  const raw = process.env.COMMENT_SCAN_SYNC;
  if (raw === "1" || raw?.toLowerCase() === "true") return true;
  if (raw === "0" || raw?.toLowerCase() === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function parseCommentSpoilerScanDebug(raw: unknown): CommentSpoilerScanDebug | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const outcome = o.outcome;
  if (typeof outcome !== "string") return null;
  const allowed: CommentSpoilerScanOutcome[] = [
    "pending",
    "safe",
    "flagged",
    "unparseable",
    "scan_failed",
    "skipped",
  ];
  if (!allowed.includes(outcome as CommentSpoilerScanOutcome)) return null;
  if (typeof o.imageChapter !== "number" || typeof o.bookTitle !== "string") return null;
  if (typeof o.scannedAt !== "string") return null;
  return {
    outcome: outcome as CommentSpoilerScanOutcome,
    imageChapter: o.imageChapter,
    bookTitle: o.bookTitle,
    rawModelText: typeof o.rawModelText === "string" ? o.rawModelText : undefined,
    parsedIsSpoiler:
      typeof o.parsedIsSpoiler === "boolean" || o.parsedIsSpoiler === null
        ? o.parsedIsSpoiler
        : undefined,
    spoilerChapter:
      typeof o.spoilerChapter === "number" || o.spoilerChapter === null
        ? o.spoilerChapter
        : undefined,
    scannedAt: o.scannedAt,
    errorMessage: typeof o.errorMessage === "string" ? o.errorMessage : undefined,
  };
}

export function formatSpoilerCheckResultLabel(debug: CommentSpoilerScanDebug | null | undefined): string {
  if (!debug) {
    return "Spoiler check result: pending (no scan record yet)";
  }
  switch (debug.outcome) {
    case "pending":
      return `Spoiler check result: pending… (image chapter ${debug.imageChapter})`;
    case "safe":
      return `Spoiler check result: safe — model said not a spoiler (image chapter ${debug.imageChapter})`;
    case "flagged":
      if (debug.spoilerChapter != null) {
        return `Spoiler check result: flagged — hidden (model spoiler chapter ${debug.spoilerChapter}, image chapter ${debug.imageChapter})`;
      }
      return `Spoiler check result: flagged — hidden as possible spoiler for readers before image chapter ${debug.imageChapter}`;
    case "unparseable":
      return `Spoiler check result: unparseable model JSON — left visible (image chapter ${debug.imageChapter})`;
    case "scan_failed":
      return `Spoiler check result: scan failed — left visible (image chapter ${debug.imageChapter})`;
    case "skipped":
      return `Spoiler check result: skipped (image chapter ${debug.imageChapter})`;
    default:
      return "Spoiler check result: unknown";
  }
}
