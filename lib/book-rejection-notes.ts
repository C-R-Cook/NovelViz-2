/** Prefix written to `Book.internalNotes` when an admin rejects a book. */
export const REJECTION_REASON_NOTES_PREFIX = "REJECTION REASON: ";

/**
 * Prepend the latest rejection reason to internal notes (replaces a prior top-level block).
 */
export function mergeRejectionReasonIntoInternalNotes(
  existingNotes: string | null | undefined,
  reason: string,
): string {
  const trimmedReason = reason.trim();
  const block = `${REJECTION_REASON_NOTES_PREFIX}${trimmedReason}`;
  const existing = (existingNotes ?? "").trim();
  if (!existing) return block;

  const withoutPrior = existing
    .replace(
      new RegExp(
        `^${REJECTION_REASON_NOTES_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*(?:\\n\\n)?`,
        "i",
      ),
      "",
    )
    .trim();

  return withoutPrior ? `${block}\n\n${withoutPrior}` : block;
}
