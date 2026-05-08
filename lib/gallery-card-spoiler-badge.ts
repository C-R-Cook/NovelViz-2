import { effectiveChapterGateMode, isChapterBehindLock } from "@/lib/gallery-spoiler";
import type { SpoilerProtection } from "@db";

export type GalleryCardBadgeVariant = "aqua" | "red" | "green" | "yellow";

type ResolveArgs = {
  viewerUserId: string | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  bookSpoilerSetting: SpoilerProtection;
  imageUserId: string;
  imageChapter: number;
  currentChapter?: number;
  locked: boolean;
};

export function resolveLibraryPadlockBadge(args: ResolveArgs): GalleryCardBadgeVariant | null {
  if (args.viewerUserId === null || args.locked) return null;

  if (args.imageUserId === args.viewerUserId) return "aqua";
  if (args.isAdmin) return null;

  if (args.bookSpoilerSetting === "UNLOCKED" && args.globalSpoilerProtection) return "red";

  const mode = effectiveChapterGateMode(args.bookSpoilerSetting, args.globalSpoilerProtection);
  const chapterBehind = isChapterBehindLock(mode, args.currentChapter, args.imageChapter);
  if (mode === "gate_chapters" && !chapterBehind) return "green";

  if (
    !args.globalSpoilerProtection &&
    (args.bookSpoilerSetting === "INHERIT" || args.bookSpoilerSetting === "UNLOCKED")
  ) {
    return "yellow";
  }

  return null;
}
