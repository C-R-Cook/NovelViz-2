import { effectiveChapterGateMode, isChapterBehindLock } from "@/lib/gallery-spoiler";
import { prisma } from "@/lib/prisma";

/** Chapter-gate lock for a public gallery image — same rules as gallery list APIs. Admin always sees unlocked. */
export async function isGeneratedImageChapterLockedForViewer(args: {
  userId: string;
  isAdmin: boolean;
  bookId: string;
  chapterNumberAtTime: number;
  /**
   * Same trust model as `GET /api/gallery/book/[bookId]?session=true` — client session “show everything” for those books.
   */
  sessionBrowsingUnlockedBookIds: string[];
}): Promise<boolean> {
  if (args.isAdmin) return false;
  if (args.sessionBrowsingUnlockedBookIds.includes(args.bookId)) return false;

  const [dbUser, userBook, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: args.userId },
      select: { globalSpoilerProtection: true },
    }),
    prisma.userBook.findFirst({
      where: { userId: args.userId, bookId: args.bookId, isActive: true },
      select: { spoilerProtection: true },
    }),
    prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId: args.userId, bookId: args.bookId } },
      select: { currentChapterNumber: true },
    }),
  ]);

  const globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;
  const mode = effectiveChapterGateMode(userBook?.spoilerProtection, globalSpoilerProtection);
  const rawChapter = progress?.currentChapterNumber;
  const currentChapter = rawChapter === null || rawChapter === undefined ? undefined : rawChapter;

  return isChapterBehindLock(mode, currentChapter, args.chapterNumberAtTime);
}

export function parseLikeRequestSessionUnlockIds(body: unknown): string[] {
  if (typeof body !== "object" || body === null) return [];
  const raw = (body as { sessionBrowsingUnlockedBookIds?: unknown }).sessionBrowsingUnlockedBookIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string");
}
