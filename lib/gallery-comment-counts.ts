import { parseCommentSpoilerScanDebug } from "@/lib/comment-spoiler-scan-debug";
import { shouldIncludeCommentForViewer, type CommentVisibilityViewer } from "@/lib/comment-visibility";
import { prisma } from "@/lib/prisma";
import { CommentStatus, UserRole, type SpoilerProtection } from "@db";

export type GalleryCommentCountImageRef = {
  id: string;
  bookId: string;
  chapterNumberAtTime: number;
};

export type GalleryCommentCountContext = {
  viewer: CommentVisibilityViewer | null;
  sessionOverride?: boolean;
  globalSpoilerProtection?: boolean;
  spoilerByBookId?: Map<string, SpoilerProtection | undefined>;
  progressByBookId?: Map<string, number>;
};

/**
 * Comment counts for gallery thumbnails — matches GET /api/comments visibility per viewer.
 */
export async function viewerVisibleCommentCountByImageIds(
  images: GalleryCommentCountImageRef[],
  ctx: GalleryCommentCountContext,
): Promise<Map<string, number>> {
  const uniqueImages = new Map<string, GalleryCommentCountImageRef>();
  for (const img of images) {
    if (img.id.length > 0) uniqueImages.set(img.id, img);
  }
  const ids = [...uniqueImages.keys()];
  if (ids.length === 0) return new Map();

  const globalSpoilerProtection = ctx.globalSpoilerProtection ?? true;
  const spoilerByBookId = ctx.spoilerByBookId ?? new Map<string, SpoilerProtection | undefined>();
  const progressByBookId = ctx.progressByBookId ?? new Map<string, number>();
  const sessionOverride = ctx.sessionOverride ?? false;

  const [rows, imageOwners] = await Promise.all([
    prisma.comment.findMany({
      where: { imageId: { in: ids }, status: { not: CommentStatus.DELETED } },
      select: {
        imageId: true,
        userId: true,
        status: true,
        spoilerGateChapter: true,
        spoilerModerationAt: true,
        spoilerScanDebug: true,
      },
    }),
    prisma.generatedImage.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    }),
  ]);

  const imageOwnerById = new Map(imageOwners.map((img) => [img.id, img.userId]));

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);

  for (const row of rows) {
    const image = uniqueImages.get(row.imageId);
    if (!image) continue;
    const include = shouldIncludeCommentForViewer({
      viewer: ctx.viewer,
      sessionOverride,
      comment: {
        status: row.status,
        userId: row.userId,
        spoilerGateChapter: row.spoilerGateChapter,
        spoilerModerationAt: row.spoilerModerationAt,
      },
      imageChapterNumber: image.chapterNumberAtTime,
      imageOwnerUserId: imageOwnerById.get(image.id) ?? "",
      userBookSpoiler: spoilerByBookId.get(image.bookId),
      globalSpoilerProtection,
      currentChapterNumber: progressByBookId.get(image.bookId),
      spoilerScanDebug: parseCommentSpoilerScanDebug(row.spoilerScanDebug),
    });
    if (include) {
      counts.set(row.imageId, (counts.get(row.imageId) ?? 0) + 1);
    }
  }

  return counts;
}

/** Resolves counts for GET /api/gallery/book/[bookId] (and featured strip) for the current viewer. */
export async function commentCountsForGalleryBook(
  images: GalleryCommentCountImageRef[],
  opts: {
    bookId: string;
    user: { id: string; role: UserRole } | null;
    sessionOverride: boolean;
    globalSpoilerProtection?: boolean;
    userBookSpoiler?: SpoilerProtection | null;
    currentChapterNumber?: number;
  },
): Promise<Map<string, number>> {
  if (!opts.user) {
    return viewerVisibleCommentCountByImageIds(images, { viewer: null });
  }
  const viewer: CommentVisibilityViewer = { id: opts.user.id, role: opts.user.role };
  if (opts.user.role === UserRole.admin || opts.sessionOverride) {
    return viewerVisibleCommentCountByImageIds(images, {
      viewer,
      sessionOverride: opts.sessionOverride,
    });
  }
  return viewerVisibleCommentCountByImageIds(images, {
    viewer,
    globalSpoilerProtection: opts.globalSpoilerProtection ?? true,
    spoilerByBookId: new Map([[opts.bookId, opts.userBookSpoiler ?? undefined]]),
    progressByBookId:
      opts.currentChapterNumber !== undefined
        ? new Map([[opts.bookId, opts.currentChapterNumber]])
        : new Map(),
  });
}
