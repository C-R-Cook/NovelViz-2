import { GalleryClient, type GalleryImageCard } from "../gallery-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

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

export async function generateMetadata({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null, status: "published" },
    select: { title: true },
  });
  if (!book) return { title: "Gallery | NovelViz" };
  return { title: `${book.title} — Gallery | NovelViz` };
}

export default async function GalleryBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null, status: "published" },
    select: { id: true, title: true, author: true },
  });
  if (!book) notFound();

  const session = await getCurrentUser();
  const isLoggedIn = !!session;
  const isAdmin = session?.role === "admin";

  const progressByBookId = new Map<string, number>();
  if (session) {
    const progress = await prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId: session.id, bookId } },
      select: { currentChapterNumber: true },
    });
    if (progress) progressByBookId.set(bookId, progress.currentChapterNumber);
  }

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

  const images = await prisma.generatedImage.findMany({
    where: { bookId, isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: baseSelect,
  });

  function toCard(image: GeneratedImageForGallery): GalleryImageCard {
    let spoilerLevel: GalleryImageCard["spoilerLevel"];
    if (isAdmin) {
      spoilerLevel = "none";
    } else if (!isLoggedIn) {
      spoilerLevel = "public";
    } else {
      const currentChapter = progressByBookId.get(image.bookId);
      if (currentChapter === undefined) spoilerLevel = "unstarted";
      else if (currentChapter >= image.chapterNumberAtTime) spoilerLevel = "none";
      else spoilerLevel = "spoiler";
    }

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
      spoilerLevel,
    };
  }

  return (
    <GalleryClient
      bookGallery={{ title: book.title, author: book.author }}
      fromLibraryImages={[]}
      trendingImages={images.map(toCard)}
      discoverImages={[]}
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
    />
  );
}
