import type { SpoilerProtection } from "@db";

export type ChapterGateMode = "show_all" | "gate_chapters";

/**
 * Resolves whether chapter-based locking applies for a book.
 * - UNLOCKED: never gate (show all images for this book).
 * - PROTECTED: always use chapter gate when comparing progress.
 * - INHERIT: follow User.globalSpoilerProtection (true → gate, false → show all).
 */
export function effectiveChapterGateMode(
  userBookSpoiler: SpoilerProtection | null | undefined,
  globalSpoilerProtection: boolean,
): ChapterGateMode {
  if (userBookSpoiler === "UNLOCKED") return "show_all";
  if (userBookSpoiler === "PROTECTED") return "gate_chapters";
  return globalSpoilerProtection ? "gate_chapters" : "show_all";
}

/** When gate mode is active: lock if the reader has not yet reached this chapter. */
export function isChapterBehindLock(
  mode: ChapterGateMode,
  currentChapter: number | undefined,
  imageChapter: number,
): boolean {
  if (mode === "show_all") return false;
  if (currentChapter === undefined) return true;
  return currentChapter < imageChapter;
}
