import { viewerVisibleCommentCountByImageIds } from "@/lib/gallery-comment-counts";
import {
  GALLERY_COVER_FALLBACK_IMAGE_ID_PREFIX,
  type BookGalleryRow,
  type GalleryDiscoveryMode,
  type GalleryImageCard,
  type GalleryLibraryMeta,
  type GalleryPageApiResponse,
} from "@/lib/gallery-types";
import { effectiveChapterGateMode, isGalleryImageChapterLocked } from "@/lib/gallery-spoiler";
import type { CommentVisibilityViewer } from "@/lib/comment-visibility";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection, UserRole } from "@db";

const DISCOVERY_ROW_LIMIT = 5;

export const galleryImageSelect = {
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
      coverImageUrl: true,
      genre: true,
      _count: { select: { chapters: true } },
    },
  },
  user: {
    select: {
      username: true,
      name: true,
    },
  },
} as const;

type GeneratedImageRow = {
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
  book: {
    title: string;
    author: string;
    coverImageUrl: string | null;
    genre: string | null;
    _count: { chapters: number };
  };
  user: { username: string | null; name: string | null };
};

export type GalleryViewerContext = {
  userId: string | null;
  role: UserRole | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  genrePreferences: string[];
  libraryBookIds: string[];
  spoilerByBookId: Map<string, SpoilerProtection | undefined>;
  progressByBookId: Map<string, number>;
  progressUpdatedAtByBookId: Map<string, Date>;
  userBookAddedAtByBookId: Map<string, Date>;
};

export function discoveryChapterThreshold(totalChapters: number): number {
  if (totalChapters <= 0) return 0;
  return Math.ceil(totalChapters * 0.1);
}

export function isChapterWithinDiscoveryThreshold(
  chapterNumberAtTime: number,
  totalChapters: number,
): boolean {
  return chapterNumberAtTime <= discoveryChapterThreshold(totalChapters);
}

function memberLock(
  image: GeneratedImageRow,
  opts: {
    viewerUserId: string;
    isAdmin: boolean;
    sessionOverride: boolean;
    globalSpoilerProtection: boolean;
    spoilerByBookId: Map<string, SpoilerProtection | undefined>;
    progressByBookId: Map<string, number>;
  },
): Pick<GalleryImageCard, "isLocked" | "lockKind"> {
  if (opts.isAdmin || opts.sessionOverride) {
    return { isLocked: false, lockKind: "none" };
  }

  if (opts.viewerUserId === image.userId) {
    return { isLocked: false, lockKind: "none" };
  }

  const bookSpoiler = opts.spoilerByBookId.get(image.bookId);
  const mode = effectiveChapterGateMode(bookSpoiler, opts.globalSpoilerProtection);
  if (mode === "show_all") {
    return { isLocked: false, lockKind: "none" };
  }

  const currentChapter = opts.progressByBookId.get(image.bookId);
  const totalChapters = image.book._count.chapters;

  if (currentChapter === undefined) {
    if (isChapterWithinDiscoveryThreshold(image.chapterNumberAtTime, totalChapters)) {
      return { isLocked: false, lockKind: "none" };
    }
    return { isLocked: true, lockKind: "unstarted" };
  }

  const behind = isGalleryImageChapterLocked({
    viewerUserId: opts.viewerUserId,
    imageUserId: image.userId,
    mode,
    currentChapter,
    imageChapter: image.chapterNumberAtTime,
    isAdmin: opts.isAdmin,
  });
  if (!behind) {
    return { isLocked: false, lockKind: "none" };
  }

  return { isLocked: true, lockKind: "chapter" };
}

function baseFields(
  image: GeneratedImageRow,
  likedByViewer: boolean,
  commentCount: number,
  ctx: GalleryViewerContext,
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
    currentChapterNumber: ctx.userId ? ctx.progressByBookId.get(image.bookId) : undefined,
    spoilerSetting: ctx.spoilerByBookId.get(image.bookId) ?? "INHERIT",
  };
}

function toDiscoveryCard(
  image: GeneratedImageRow,
  likedByViewer: boolean,
  commentCount: number,
): GalleryImageCard {
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
    isLocked: false,
    lockKind: "none",
  };
}

async function viewerLikedIdSet(userId: string | null, imageIds: string[]): Promise<Set<string>> {
  if (!userId) return new Set();
  const unique = [...new Set(imageIds)];
  if (unique.length === 0) return new Set();
  const rows = await prisma.like.findMany({
    where: { userId, imageId: { in: unique } },
    select: { imageId: true },
  });
  return new Set(rows.map((r) => r.imageId));
}

export async function isDiscoveryPreviewLikeAllowed(args: {
  userId: string;
  bookId: string;
  chapterNumberAtTime: number;
}): Promise<boolean> {
  const inLibrary = await prisma.userBook.findFirst({
    where: { userId: args.userId, bookId: args.bookId, isActive: true },
    select: { id: true },
  });
  if (inLibrary) return false;

  const chapterCount = await prisma.chapter.count({ where: { bookId: args.bookId } });
  return isChapterWithinDiscoveryThreshold(args.chapterNumberAtTime, chapterCount);
}

function buildLibraryRowsFromImages(
  images: GeneratedImageRow[],
  ctx: GalleryViewerContext,
  sessionOverride: boolean,
  likedIds: Set<string>,
  countMap: Map<string, number>,
): BookGalleryRow[] {
  if (!ctx.userId || ctx.libraryBookIds.length === 0) return [];

  const lockOpts = {
    viewerUserId: ctx.userId,
    isAdmin: ctx.isAdmin,
    sessionOverride,
    globalSpoilerProtection: ctx.globalSpoilerProtection,
    spoilerByBookId: ctx.spoilerByBookId,
    progressByBookId: ctx.progressByBookId,
  };

  const byBook = new Map<string, GalleryImageCard[]>();
  const bookMeta = new Map<
    string,
    { title: string; author: string; coverImageUrl: string | null; genre: string | null }
  >();
  const totalPublicByBook = new Map<string, number>();

  for (const img of images) {
    totalPublicByBook.set(img.bookId, (totalPublicByBook.get(img.bookId) ?? 0) + 1);

    const lock = memberLock(img, lockOpts);

    const card: GalleryImageCard = {
      ...baseFields(img, likedIds.has(img.id), countMap.get(img.id) ?? 0, ctx),
      ...lock,
    };

    if (!byBook.has(img.bookId)) {
      byBook.set(img.bookId, []);
      bookMeta.set(img.bookId, {
        title: img.book.title,
        author: img.book.author,
        coverImageUrl: img.book.coverImageUrl,
        genre: img.book.genre,
      });
    }
    byBook.get(img.bookId)!.push(card);
  }

  const orderedBookIds = [...byBook.keys()].sort((a, b) => {
    const aUpdated = ctx.progressUpdatedAtByBookId.get(a)?.getTime() ?? 0;
    const bUpdated = ctx.progressUpdatedAtByBookId.get(b)?.getTime() ?? 0;
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    const aAdded = ctx.userBookAddedAtByBookId.get(a)?.getTime() ?? 0;
    const bAdded = ctx.userBookAddedAtByBookId.get(b)?.getTime() ?? 0;
    return bAdded - aAdded;
  });

  return orderedBookIds.map((bookId) => {
    const meta = bookMeta.get(bookId)!;
    return {
      bookId,
      title: meta.title,
      author: meta.author,
      coverImageUrl: meta.coverImageUrl,
      genre: meta.genre,
      totalPublicImages: totalPublicByBook.get(bookId) ?? 0,
      images: byBook.get(bookId)!,
    };
  });
}

function toCoverFallbackCard(book: {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string;
  updatedAt: Date;
}): GalleryImageCard {
  return {
    id: `${GALLERY_COVER_FALLBACK_IMAGE_ID_PREFIX}${book.id}`,
    imageUrl: book.coverImageUrl,
    userPrompt: "AI-generated cover art",
    chapterNumberAtTime: 1,
    createdAt: book.updatedAt.toISOString(),
    likeCount: 0,
    isPublic: true,
    likedByViewer: false,
    commentCount: 0,
    isFeatured: false,
    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    userName: null,
    userId: "",
    isLocked: false,
    lockKind: "none",
  };
}

async function buildCoverFallbackDiscoveryRows(ctx: GalleryViewerContext): Promise<BookGalleryRow[]> {
  const books = await prisma.book.findMany({
    where: {
      deletedAt: null,
      status: "published",
      coverIsAiGenerated: true,
      coverImageUrl: { not: null },
      ...(ctx.libraryBookIds.length > 0 ? { id: { notIn: ctx.libraryBookIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
      genre: true,
      updatedAt: true,
    },
  });

  const genrePrefs = new Set(ctx.genrePreferences);
  const sorted = books
    .filter((b): b is typeof b & { coverImageUrl: string } => b.coverImageUrl != null)
    .map((book) => ({
      book,
      genreMatch:
        book.genre != null && genrePrefs.size > 0 && genrePrefs.has(book.genre) ? 1 : 0,
    }))
    .sort((a, b) => {
      if (b.genreMatch !== a.genreMatch) return b.genreMatch - a.genreMatch;
      return b.book.updatedAt.getTime() - a.book.updatedAt.getTime();
    })
    .slice(0, DISCOVERY_ROW_LIMIT);

  return sorted.map(({ book }) => ({
    bookId: book.id,
    title: book.title,
    author: book.author,
    coverImageUrl: book.coverImageUrl,
    genre: book.genre,
    totalPublicImages: 0,
    isCoverFallback: true,
    images: [toCoverFallbackCard(book)],
  }));
}

function buildDiscoveryRowsFromImages(
  candidateBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
    genre: string | null;
    chapterCount: number;
  }>,
  allPublicImages: GeneratedImageRow[],
  ctx: GalleryViewerContext,
  likedIds: Set<string>,
  countMap: Map<string, number>,
): BookGalleryRow[] {
  const thresholdByBook = new Map(
    candidateBooks.map((b) => [b.id, discoveryChapterThreshold(b.chapterCount)]),
  );
  const bookById = new Map(candidateBooks.map((b) => [b.id, b]));

  const totalPublicByBook = new Map<string, number>();
  const qualifyingByBook = new Map<string, GeneratedImageRow[]>();

  for (const img of allPublicImages) {
    if (!bookById.has(img.bookId)) continue;
    totalPublicByBook.set(img.bookId, (totalPublicByBook.get(img.bookId) ?? 0) + 1);
    if (ctx.isAdmin) {
      if (!qualifyingByBook.has(img.bookId)) qualifyingByBook.set(img.bookId, []);
      qualifyingByBook.get(img.bookId)!.push(img);
      continue;
    }
    const threshold = thresholdByBook.get(img.bookId) ?? 0;
    if (img.chapterNumberAtTime > threshold) continue;
    if (!qualifyingByBook.has(img.bookId)) qualifyingByBook.set(img.bookId, []);
    qualifyingByBook.get(img.bookId)!.push(img);
  }

  const genrePrefs = new Set(ctx.genrePreferences);
  const scored = candidateBooks
    .filter((b) => (qualifyingByBook.get(b.id)?.length ?? 0) > 0)
    .map((b) => {
      const genreMatch =
        b.genre != null && genrePrefs.size > 0 && genrePrefs.has(b.genre) ? 1 : 0;
      const qualifyingCount = qualifyingByBook.get(b.id)?.length ?? 0;
      return { book: b, genreMatch, qualifyingCount };
    })
    .sort((a, b) => {
      if (b.genreMatch !== a.genreMatch) return b.genreMatch - a.genreMatch;
      return b.qualifyingCount - a.qualifyingCount;
    })
    .slice(0, DISCOVERY_ROW_LIMIT);

  return scored.map(({ book }) => ({
    bookId: book.id,
    title: book.title,
    author: book.author,
    coverImageUrl: book.coverImageUrl,
    genre: book.genre,
    totalPublicImages: totalPublicByBook.get(book.id) ?? 0,
    images: (qualifyingByBook.get(book.id) ?? []).map((img) =>
      toDiscoveryCard(img, likedIds.has(img.id), countMap.get(img.id) ?? 0),
    ),
  }));
}

export async function loadGalleryViewerContext(user: {
  id: string;
  role: UserRole;
  globalSpoilerProtection: boolean;
  genrePreferences: string[];
}): Promise<GalleryViewerContext> {
  const [userBookRows, allProgress] = await Promise.all([
    prisma.userBook.findMany({
      where: { userId: user.id, isActive: true },
      select: { bookId: true, spoilerProtection: true, addedAt: true },
    }),
    prisma.readingProgress.findMany({
      where: { userId: user.id },
      select: { bookId: true, currentChapterNumber: true, updatedAt: true },
    }),
  ]);

  return {
    userId: user.id,
    role: user.role,
    isAdmin: user.role === "admin",
    globalSpoilerProtection: user.globalSpoilerProtection,
    genrePreferences: user.genrePreferences,
    libraryBookIds: userBookRows.map((r) => r.bookId),
    spoilerByBookId: new Map(userBookRows.map((r) => [r.bookId, r.spoilerProtection])),
    progressByBookId: new Map(allProgress.map((p) => [p.bookId, p.currentChapterNumber])),
    progressUpdatedAtByBookId: new Map(allProgress.map((p) => [p.bookId, p.updatedAt])),
    userBookAddedAtByBookId: new Map(userBookRows.map((r) => [r.bookId, r.addedAt])),
  };
}

export async function buildGalleryPageResponse(args: {
  ctx: GalleryViewerContext;
  sessionOverride: boolean;
}): Promise<GalleryPageApiResponse> {
  const { ctx, sessionOverride } = args;

  const excludeIds = ctx.libraryBookIds;

  const [libraryImages, candidateBooksRaw] = await Promise.all([
    ctx.libraryBookIds.length > 0
      ? prisma.generatedImage.findMany({
          where: {
            isPublic: true,
            bookId: { in: ctx.libraryBookIds },
            book: { deletedAt: null, status: "published" },
          },
          orderBy: { createdAt: "desc" },
          select: galleryImageSelect,
        })
      : Promise.resolve([]),
    prisma.book.findMany({
      where: {
        deletedAt: null,
        status: "published",
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        generatedImages: { some: { isPublic: true } },
      },
      select: {
        id: true,
        title: true,
        author: true,
        coverImageUrl: true,
        genre: true,
        _count: { select: { chapters: true } },
      },
    }),
  ]);

  const candidateBooks = candidateBooksRaw.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverImageUrl: b.coverImageUrl,
    genre: b.genre,
    chapterCount: b._count.chapters,
  }));
  const discoveryBookIds = candidateBooks.map((b) => b.id);

  const discoveryImages =
    discoveryBookIds.length > 0
      ? await prisma.generatedImage.findMany({
          where: { isPublic: true, bookId: { in: discoveryBookIds } },
          orderBy: { createdAt: "desc" },
          select: galleryImageSelect,
        })
      : [];

  const countRefs = [...libraryImages, ...discoveryImages].map((img) => ({
    id: img.id,
    bookId: img.bookId,
    chapterNumberAtTime: img.chapterNumberAtTime,
  }));

  const likedIds = await viewerLikedIdSet(ctx.userId, countRefs.map((r) => r.id));

  const viewer: CommentVisibilityViewer | null =
    ctx.userId && ctx.role ? { id: ctx.userId, role: ctx.role } : null;

  const countMap = await viewerVisibleCommentCountByImageIds(countRefs, {
    viewer,
    sessionOverride: ctx.isAdmin || (sessionOverride && !!ctx.userId),
    globalSpoilerProtection: ctx.globalSpoilerProtection,
    spoilerByBookId: ctx.spoilerByBookId,
    progressByBookId: ctx.progressByBookId,
  });

  const libraryRows = buildLibraryRowsFromImages(
    libraryImages,
    ctx,
    sessionOverride,
    likedIds,
    countMap,
  );
  let discoveryRows = buildDiscoveryRowsFromImages(
    candidateBooks,
    discoveryImages,
    ctx,
    likedIds,
    countMap,
  );
  let discoveryMode: GalleryDiscoveryMode = "community";
  if (discoveryRows.length === 0) {
    discoveryRows = await buildCoverFallbackDiscoveryRows(ctx);
    if (discoveryRows.length > 0) {
      discoveryMode = "cover-fallback";
    }
  }

  return {
    libraryRows,
    discoveryRows,
    discoveryMode,
    userGenrePreferences: ctx.genrePreferences,
    libraryMeta: {
      hasLibraryBooks: ctx.libraryBookIds.length > 0,
      hasVisibleLibraryImages: libraryRows.length > 0,
    },
  };
}

export function emptyGuestGalleryContext(): GalleryViewerContext {
  return {
    userId: null,
    role: null,
    isAdmin: false,
    globalSpoilerProtection: true,
    genrePreferences: [],
    libraryBookIds: [],
    spoilerByBookId: new Map(),
    progressByBookId: new Map(),
    progressUpdatedAtByBookId: new Map(),
    userBookAddedAtByBookId: new Map(),
  };
}
