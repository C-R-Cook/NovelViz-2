import { GalleryBookClient } from "../gallery-book-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null, status: "published" },
    select: { title: true },
  });
  if (!book) return { title: "Public Gallery | NovelViz" };
  return { title: `${book.title} — Public Gallery | NovelViz` };
}

export default async function GalleryBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null, status: "published" },
    select: { id: true, title: true, author: true, coverImageUrl: true },
  });
  if (!book) notFound();

  const session = await getCurrentUser();
  const isLoggedIn = !!session;
  const isAdmin = session?.role === "admin";

  const [imageCount, dbUser, userBook] = await Promise.all([
    prisma.generatedImage.count({ where: { bookId, isPublic: true } }),
    session
      ? prisma.user.findUnique({
          where: { id: session.id },
          select: { globalSpoilerProtection: true },
        })
      : Promise.resolve(null),
    session
      ? prisma.userBook.findFirst({
          where: { userId: session.id, bookId, isActive: true },
          select: { spoilerProtection: true },
        })
      : Promise.resolve(null),
  ]);

  const globalSpoilerProtection = dbUser?.globalSpoilerProtection ?? true;

  return (
    <GalleryBookClient
      bookId={book.id}
      bookTitle={book.title}
      bookAuthor={book.author}
      coverImageUrl={book.coverImageUrl}
      imageCount={imageCount}
      globalSpoilerProtection={globalSpoilerProtection}
      userBookSpoiler={userBook?.spoilerProtection ?? null}
      isLoggedIn={isLoggedIn}
      isAdmin={!!isAdmin}
      viewerUserId={session?.id ?? null}
      viewerDisplayName={session?.username ?? session?.name ?? null}
    />
  );
}
