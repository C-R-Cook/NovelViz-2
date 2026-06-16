import { GalleryClient, type GalleryImageCard, type GalleryLockKind } from "./gallery-client";
import { getCurrentUser } from "@/lib/auth";
import {
  FEATURED_IMAGE_GALLERY_LIMIT,
  getFeaturedImageIdsForDisplay,
} from "@/lib/featured-image-selection";
import { viewerVisibleCommentCountByImageIds } from "@/lib/gallery-comment-counts";
import type { CommentVisibilityViewer } from "@/lib/comment-visibility";
import { effectiveChapterGateMode, isGalleryImageChapterLocked } from "@/lib/gallery-spoiler";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection } from "@db";

export const metadata = {
  title: "Public Gallery | NovelViz",
};

type GeneratedImageForGallery = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: Date;
  likeCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  bookId: string;
  userId: string;
  book: { title: string; author: string };
  user: { username: string | null; name: string | null };
};

const baseSelect = {
  id: true,
  imageUrl: true,
  userPrompt: true,
  chapterNumberAtTime: true,
  createdAt: true,
  likeCount: true,
  isPublic: true,
  isFeatured: true,
  bookId: true,
  userId: true,
  book: {
    select: {
      title: true,
      author: true,
    },
  },
  user: {
    select: {
      username: true,
      name: true,
    },
  },
};

function baseFields(
  image: GeneratedImageForGallery,
  likedByViewer: boolean,
  commentCount = 0,
): Omit<GalleryImageCard, "isLocked" | "lockKind"> {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    userPrompt: image.userPrompt,
    chapterNumberAtTime: image.chapterNumberAtTime,
    createdAt: image.createdAt.toISOString(),
    likeCount: image.likeCount,
    isPublic: image.isPublic,
    isFeatured: image.isFeatured,
    likedByViewer,
    bookId: image.bookId,
    bookTitle: image.book.title,
    bookAuthor: image.book.author,
    userName: image.user.username ?? image.user.name ?? null,
    userId: image.userId,
    commentCount,
  };
}

function toGuestFeaturedCard(image: GeneratedImageForGallery, commentCount = 0): GalleryImageCard {
  return {
    ...baseFields(image, false, commentCount),
    isLocked: false,
    lockKind: "none",
  };
}

function toGuestBlurCard(image: GeneratedImageForGallery, commentCount = 0): GalleryImageCard {
  return {
    ...baseFields(image, false, commentCount),
    isLocked: true,
    lockKind: "guest_blur",
  };
}

function memberLock(
  image: GeneratedImageForGallery,
  opts: {
    viewerUserId: string;
    isAdmin: boolean;
    globalSpoilerProtection: boolean;
    spoilerByBookId: Map<string, SpoilerProtection | undefined>;
    progressByBookId: Map<string, number>;
  },
): Pick<GalleryImageCard, "isLocked" | "lockKind"> {
  if (opts.isAdmin) {
    return { isLocked: false, lockKind: "none" };
  }

  const bookSpoiler = opts.spoilerByBookId.get(image.bookId);
  const mode = effectiveChapterGateMode(bookSpoiler, opts.globalSpoilerProtection);
  const currentChapter = opts.progressByBookId.get(image.bookId);
  const behind = isGalleryImageChapterLocked({
    viewerUserId: opts.viewerUserId,
    imageUserId: image.userId,
    mode,
    currentChapter,
    imageChapter: image.chapterNumberAtTime,
  });
  if (!behind) {
    return { isLocked: false, lockKind: "none" };
  }

  let lockKind: GalleryLockKind = "chapter";
  if (currentChapter === undefined) {
    lockKind = "unstarted";
  }

  return { isLocked: true, lockKind };
}

function toCountImages(rows: GeneratedImageForGallery[]) {
  return rows.map((img) => ({
    id: img.id,
    bookId: img.bookId,
    chapterNumberAtTime: img.chapterNumberAtTime,
  }));
}

async function commentCountsForGallery(
  rows: GeneratedImageForGallery[],
  ctx: {
    viewer: CommentVisibilityViewer | null;
    globalSpoilerProtection: boolean;
    spoilerByBookId: Map<string, SpoilerProtection | undefined>;
    progressByBookId: Map<string, number>;
  },
) {
  return viewerVisibleCommentCountByImageIds(toCountImages(rows), ctx);
}

async function viewerLikedIdSet(userId: string, imageIds: string[]) {
  const unique = [...new Set(imageIds)];
  if (unique.length === 0) return new Set<string>();
  const rows = await prisma.like.findMany({
    where: { userId, imageId: { in: unique } },
    select: { imageId: true },
  });
  return new Set(rows.map((r) => r.imageId));
}

async function featuredImagesForViewer(userId: string | null) {
  const ids = await getFeaturedImageIdsForDisplay(userId, FEATURED_IMAGE_GALLERY_LIMIT);
  if (ids.length === 0) return [];
  const rows = await prisma.generatedImage.findMany({
    where: { id: { in: ids } },
    select: baseSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is GeneratedImageForGallery => row != null);
}

export default async function GalleryPage() {
  const session = await getCurrentUser();

  const guestLatestFeatured = featuredImagesForViewer(null);
  const guestLibraryBlur = prisma.generatedImage.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: baseSelect,
  });

  if (!session) {
    const [latest, blur] = await Promise.all([guestLatestFeatured, guestLibraryBlur]);
    const countMap = await commentCountsForGallery([...latest, ...blur], {
      viewer: null,
      globalSpoilerProtection: true,
      spoilerByBookId: new Map(),
      progressByBookId: new Map(),
    });
    const countFor = (id: string) => countMap.get(id) ?? 0;
    return (
      <GalleryClient
        layout="guest"
        latestFeatured={latest.map((img) => toGuestFeaturedCard(img, countFor(img.id)))}
        libraryBlur={blur.map((img) => toGuestBlurCard(img, countFor(img.id)))}
        viewerUserId={null}
      />
    );
  }

  const isAdmin = session.role === "admin";

  const [dbUser, userBookRows, allProgress, featured] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { globalSpoilerProtection: true },
    }),
    prisma.userBook.findMany({
      where: { userId: session.id, isActive: true },
      select: { bookId: true, spoilerProtection: true },
    }),
    prisma.readingProgress.findMany({
      where: { userId: session.id },
      select: { bookId: true, currentChapterNumber: true },
    }),
    featuredImagesForViewer(session.id),
  ]);

  const globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;
  const userLibraryBookIds = userBookRows.map((r) => r.bookId);
  const spoilerByBookId = new Map<string, SpoilerProtection | undefined>(
    userBookRows.map((r) => [r.bookId, r.spoilerProtection]),
  );
  const spoilerSettingsByBookId = Object.fromEntries(
    userBookRows.map((r) => [r.bookId, r.spoilerProtection]),
  ) as Record<string, SpoilerProtection>;
  const progressByBookId = new Map<string, number>(
    allProgress.map((p) => [p.bookId, p.currentChapterNumber]),
  );

  const lockCtx = {
    viewerUserId: session.id,
    isAdmin,
    globalSpoilerProtection,
    spoilerByBookId,
    progressByBookId,
  };

  if (userLibraryBookIds.length === 0) {
    const likedIds = await viewerLikedIdSet(
      session.id,
      featured.map((i) => i.id),
    );
    const viewer: CommentVisibilityViewer = { id: session.id, role: session.role };
    const countMap = await commentCountsForGallery(featured, {
      viewer,
      globalSpoilerProtection,
      spoilerByBookId,
      progressByBookId,
    });
    const featuredCards = featured.map((img) => ({
      ...baseFields(img, likedIds.has(img.id), countMap.get(img.id) ?? 0),
      currentChapterNumber: progressByBookId.get(img.bookId),
      spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
      ...memberLock(img, lockCtx),
    }));

    return (
      <GalleryClient
        layout="member"
        isAdmin={!!isAdmin}
        viewerUserId={session.id}
        globalSpoilerProtection={globalSpoilerProtection}
        libraryBookIds={userLibraryBookIds}
        library={{ kind: "no_books" }}
        featured={featuredCards}
        spoilerSettingsByBookId={spoilerSettingsByBookId}
        viewerDisplayName={session.username ?? session.name ?? null}
      />
    );
  }

  const libraryRows = await prisma.generatedImage.findMany({
    where: { isPublic: true, bookId: { in: userLibraryBookIds } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: baseSelect,
  });

  const likedIds = await viewerLikedIdSet(session.id, [
    ...libraryRows.map((i) => i.id),
    ...featured.map((i) => i.id),
  ]);
  const viewer: CommentVisibilityViewer = { id: session.id, role: session.role };
  const countMap = await commentCountsForGallery([...libraryRows, ...featured], {
    viewer,
    globalSpoilerProtection,
    spoilerByBookId,
    progressByBookId,
  });

  const libraryCards = libraryRows.map((img) => ({
    ...baseFields(img, likedIds.has(img.id), countMap.get(img.id) ?? 0),
    currentChapterNumber: progressByBookId.get(img.bookId),
    spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
    ...memberLock(img, lockCtx),
  }));

  const featuredCards = featured.map((img) => ({
    ...baseFields(img, likedIds.has(img.id), countMap.get(img.id) ?? 0),
    currentChapterNumber: progressByBookId.get(img.bookId),
    spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
    ...memberLock(img, lockCtx),
  }));

  return (
    <GalleryClient
      layout="member"
      isAdmin={!!isAdmin}
      viewerUserId={session.id}
      globalSpoilerProtection={globalSpoilerProtection}
      libraryBookIds={userLibraryBookIds}
      library={libraryRows.length === 0 ? { kind: "no_images" } : { kind: "images", images: libraryCards }}
      featured={featuredCards}
      spoilerSettingsByBookId={spoilerSettingsByBookId}
      viewerDisplayName={session.username ?? session.name ?? null}
    />
  );
}
