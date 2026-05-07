import { GalleryClient, type GalleryImageCard, type GalleryLockKind } from "./gallery-client";
import { getCurrentUser } from "@/lib/auth";
import { effectiveChapterGateMode, isChapterBehindLock } from "@/lib/gallery-spoiler";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection } from "@db";

export const metadata = {
  title: "Gallery | NovelViz",
};

type GeneratedImageForGallery = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: Date;
  likeCount: number;
  bookId: string;
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
  bookId: true,
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

function baseFields(image: GeneratedImageForGallery): Omit<GalleryImageCard, "isLocked" | "lockKind"> {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    userPrompt: image.userPrompt,
    chapterNumberAtTime: image.chapterNumberAtTime,
    createdAt: image.createdAt.toISOString(),
    likeCount: image.likeCount,
    bookId: image.bookId,
    bookTitle: image.book.title,
    bookAuthor: image.book.author,
    userName: image.user.username ?? image.user.name ?? null,
  };
}

function toGuestFeaturedCard(image: GeneratedImageForGallery): GalleryImageCard {
  return {
    ...baseFields(image),
    isLocked: false,
    lockKind: "none",
  };
}

function toGuestBlurCard(image: GeneratedImageForGallery): GalleryImageCard {
  return {
    ...baseFields(image),
    isLocked: true,
    lockKind: "guest_blur",
  };
}

function memberLock(
  image: GeneratedImageForGallery,
  opts: {
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
  const behind = isChapterBehindLock(mode, currentChapter, image.chapterNumberAtTime);
  if (!behind) {
    return { isLocked: false, lockKind: "none" };
  }

  let lockKind: GalleryLockKind = "chapter";
  if (currentChapter === undefined) {
    lockKind = "unstarted";
  }

  return { isLocked: true, lockKind };
}

export default async function GalleryPage() {
  const session = await getCurrentUser();
  const isLoggedIn = !!session;
  const isAdmin = session?.role === "admin";

  let userLibraryBookIds: string[] = [];
  if (session) {
    const userBooks = await prisma.userBook.findMany({
      where: { userId: session.id, isActive: true },
      select: { bookId: true },
    });
    userLibraryBookIds = userBooks.map((row) => row.bookId);
  }

  const guestLatestFeatured = prisma.generatedImage.findMany({
    where: { isPublic: true },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: baseSelect,
  });

  const guestLibraryBlur = prisma.generatedImage.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: baseSelect,
  });

  if (!session) {
    const [latest, blur] = await Promise.all([guestLatestFeatured, guestLibraryBlur]);
    return (
      <GalleryClient
        layout="guest"
        latestFeatured={latest.map(toGuestFeaturedCard)}
        libraryBlur={blur.map(toGuestBlurCard)}
      />
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { globalSpoilerProtection: true },
  });
  const globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;

  const userBookRows = await prisma.userBook.findMany({
    where: { userId: session.id, isActive: true },
    select: { bookId: true, spoilerProtection: true },
  });
  const spoilerByBookId = new Map<string, SpoilerProtection | undefined>(
    userBookRows.map((r) => [r.bookId, r.spoilerProtection]),
  );
  const spoilerSettingsByBookId = Object.fromEntries(
    userBookRows.map((r) => [r.bookId, r.spoilerProtection]),
  ) as Record<string, SpoilerProtection>;

  const allProgress = await prisma.readingProgress.findMany({
    where: { userId: session.id },
    select: { bookId: true, currentChapterNumber: true },
  });
  const progressByBookId = new Map<string, number>(allProgress.map((p) => [p.bookId, p.currentChapterNumber]));

  const lockCtx = {
    isAdmin: !!isAdmin,
    globalSpoilerProtection,
    spoilerByBookId,
    progressByBookId,
  };

  const featuredPromise = prisma.generatedImage.findMany({
    where: { isPublic: true },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: baseSelect,
  });

  if (userLibraryBookIds.length === 0) {
    const featured = await featuredPromise;
    const featuredCards = featured.map((img) => ({
      ...baseFields(img),
      currentChapterNumber: progressByBookId.get(img.bookId),
      spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
      ...memberLock(img, lockCtx),
    }));

    return (
      <GalleryClient
        layout="member"
        isAdmin={!!isAdmin}
        globalSpoilerProtection={globalSpoilerProtection}
        library={{ kind: "no_books" }}
        featured={featuredCards}
        spoilerSettingsByBookId={spoilerSettingsByBookId}
      />
    );
  }

  const [libraryRows, featured] = await Promise.all([
    prisma.generatedImage.findMany({
      where: { isPublic: true, bookId: { in: userLibraryBookIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: baseSelect,
    }),
    featuredPromise,
  ]);

  const libraryCards = libraryRows.map((img) => ({
    ...baseFields(img),
    currentChapterNumber: progressByBookId.get(img.bookId),
    spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
    ...memberLock(img, lockCtx),
  }));

  const featuredCards = featured.map((img) => ({
    ...baseFields(img),
    currentChapterNumber: progressByBookId.get(img.bookId),
    spoilerSetting: spoilerByBookId.get(img.bookId) ?? "INHERIT",
    ...memberLock(img, lockCtx),
  }));

  return (
    <GalleryClient
      layout="member"
      isAdmin={!!isAdmin}
      globalSpoilerProtection={globalSpoilerProtection}
      library={libraryRows.length === 0 ? { kind: "no_images" } : { kind: "images", images: libraryCards }}
      featured={featuredCards}
      spoilerSettingsByBookId={spoilerSettingsByBookId}
    />
  );
}
