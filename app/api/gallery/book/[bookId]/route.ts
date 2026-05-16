import { getCurrentUser } from "@/lib/auth";
import { commentCountsForGalleryBook } from "@/lib/gallery-comment-counts";
import { prisma } from "@/lib/prisma";
import { effectiveChapterGateMode, isChapterBehindLock } from "@/lib/gallery-spoiler";
import type { SpoilerProtection } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ bookId: string }> };

/**
 * GET /api/gallery/book/[bookId]
 * Query: ?session=true — client session override; all images returned as unlocked for authenticated users.
 * Note: cannot use /api/gallery/[bookId] because that conflicts with /api/gallery/[imageId].
 */
export async function GET(request: Request, context: RouteContext) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const sessionOverride = url.searchParams.get("session") === "true";

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null, status: "published" },
    select: { id: true, title: true, author: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const user = await getCurrentUser();

  const featured = url.searchParams.get("featured") === "true";
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "8", 10);
  const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 8, 20);

  if (featured) {
    const featuredImages = await prisma.generatedImage.findMany({
      where: { bookId, isFeatured: true, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { username: true, name: true } },
      },
    });

    const countRefs = featuredImages.map((img) => ({
      id: img.id,
      bookId: img.bookId,
      chapterNumberAtTime: img.chapterNumberAtTime,
    }));

    let globalSpoilerProtection = true;
    let userBookSpoiler: SpoilerProtection | null = null;
    let currentChapterNumber: number | undefined;

    if (user && user.role !== "admin" && !sessionOverride) {
      const [dbUser, userBook, progress] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: { globalSpoilerProtection: true },
        }),
        prisma.userBook.findFirst({
          where: { userId: user.id, bookId, isActive: true },
          select: { spoilerProtection: true },
        }),
        prisma.readingProgress.findUnique({
          where: { userId_bookId: { userId: user.id, bookId } },
          select: { currentChapterNumber: true },
        }),
      ]);
      globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;
      userBookSpoiler = userBook?.spoilerProtection ?? null;
      currentChapterNumber = progress?.currentChapterNumber;
    }

    const commentCountByImage = await commentCountsForGalleryBook(countRefs, {
      bookId,
      user,
      sessionOverride,
      globalSpoilerProtection,
      userBookSpoiler,
      currentChapterNumber,
    });

    return NextResponse.json({
      images: featuredImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        userPrompt: img.userPrompt,
        chapterNumberAtTime: img.chapterNumberAtTime,
        username: img.user.username ?? img.user.name ?? "",
        likeCount: 0,
        isLocked: false,
        bookId: img.bookId,
        commentCount: commentCountByImage.get(img.id) ?? 0,
      })),
    });
  }

  const images = await prisma.generatedImage.findMany({
    where: { bookId, isPublic: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      imageUrl: true,
      userPrompt: true,
      chapterNumberAtTime: true,
      createdAt: true,
      userId: true,
      likeCount: true,
      isPublic: true,
      user: { select: { username: true, name: true } },
    },
  });

  const imageIds = images.map((i) => i.id);
  const countRefs = images.map((img) => ({
    id: img.id,
    bookId,
    chapterNumberAtTime: img.chapterNumberAtTime,
  }));

  const viewerLikedIds = new Set<string>();
  if (user !== null && imageIds.length > 0) {
    const likedRows = await prisma.like.findMany({
      where: { userId: user.id, imageId: { in: imageIds } },
      select: { imageId: true },
    });
    for (const row of likedRows) viewerLikedIds.add(row.imageId);
  }

  if (!user) {
    const commentCountByImage = await commentCountsForGalleryBook(countRefs, {
      bookId,
      user: null,
      sessionOverride: false,
    });
    return NextResponse.json({
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      currentChapterNumber: null,
      images: images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        userPrompt: img.userPrompt,
        chapterNumberAtTime: img.chapterNumberAtTime,
        createdAt: img.createdAt.toISOString(),
        userId: img.userId,
        username: img.user.username ?? img.user.name ?? "",
        likeCount: img.likeCount,
        isPublic: img.isPublic,
        likedByViewer: viewerLikedIds.has(img.id),
        isLocked: false,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        commentCount: commentCountByImage.get(img.id) ?? 0,
      })),
    });
  }

  if (user.role === "admin" || sessionOverride) {
    const progress =
      sessionOverride && user
        ? await prisma.readingProgress.findUnique({
            where: { userId_bookId: { userId: user.id, bookId } },
            select: { currentChapterNumber: true },
          })
        : null;
    const commentCountByImage = await commentCountsForGalleryBook(countRefs, {
      bookId,
      user,
      sessionOverride,
    });
    return NextResponse.json({
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      currentChapterNumber: progress?.currentChapterNumber ?? null,
      images: images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        userPrompt: img.userPrompt,
        chapterNumberAtTime: img.chapterNumberAtTime,
        createdAt: img.createdAt.toISOString(),
        userId: img.userId,
        username: img.user.username ?? img.user.name ?? "",
        likeCount: img.likeCount,
        isPublic: img.isPublic,
        likedByViewer: viewerLikedIds.has(img.id),
        isLocked: false,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        commentCount: commentCountByImage.get(img.id) ?? 0,
      })),
    });
  }

  const [dbUser, userBook, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { globalSpoilerProtection: true },
    }),
    prisma.userBook.findFirst({
      where: { userId: user.id, bookId, isActive: true },
      select: { spoilerProtection: true },
    }),
    prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId: user.id, bookId } },
      select: { currentChapterNumber: true },
    }),
  ]);

  const globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;
  const mode = effectiveChapterGateMode(userBook?.spoilerProtection, globalSpoilerProtection);
  const currentChapter = progress?.currentChapterNumber;

  const commentCountByImage = await commentCountsForGalleryBook(countRefs, {
    bookId,
    user,
    sessionOverride: false,
    globalSpoilerProtection,
    userBookSpoiler: userBook?.spoilerProtection ?? null,
    currentChapterNumber: currentChapter,
  });

  return NextResponse.json({
    bookId: book.id,
    bookTitle: book.title,
    author: book.author,
    currentChapterNumber: currentChapter ?? null,
    images: images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      userPrompt: img.userPrompt,
      chapterNumberAtTime: img.chapterNumberAtTime,
      createdAt: img.createdAt.toISOString(),
      userId: img.userId,
      username: img.user.username ?? img.user.name ?? "",
      likeCount: img.likeCount,
      isPublic: img.isPublic,
      likedByViewer: viewerLikedIds.has(img.id),
      isLocked: isChapterBehindLock(mode, currentChapter, img.chapterNumberAtTime),
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      commentCount: commentCountByImage.get(img.id) ?? 0,
    })),
  });
}
