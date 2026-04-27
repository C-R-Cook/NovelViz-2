import { GalleryClient, type GalleryImageCard } from "./gallery-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Gallery | NovelViz",
};

export default async function GalleryPage() {
  const session = await getCurrentUser();
  const dbUser = session
    ? await prisma.user.findUnique({
        where: { clerkId: session.clerkId },
        select: { id: true },
      })
    : null;

  const isLoggedIn = !!dbUser;

  let userLibraryBookIds: string[] = [];
  if (dbUser) {
    const userBooks = await prisma.userBook.findMany({
      where: { userId: dbUser.id, isActive: true },
      select: { bookId: true },
    });
    userLibraryBookIds = userBooks.map((row) => row.bookId);
  }

  const images = await prisma.generatedImage.findMany({
    where: { isPublic: true },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      imageUrl: true,
      userPrompt: true,
      fullPrompt: true,
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
          name: true,
        },
      },
    },
  });

  const bookIds = [...new Set(images.map((image) => image.bookId))];
  const progressByBookId = new Map<string, number>();

  if (dbUser && bookIds.length > 0) {
    const progresses = await prisma.readingProgress.findMany({
      where: { userId: dbUser.id, bookId: { in: bookIds } },
      select: { bookId: true, currentChapterNumber: true },
    });
    for (const row of progresses) {
      progressByBookId.set(row.bookId, row.currentChapterNumber);
    }
  }

  const cards: GalleryImageCard[] = images.map((image) => {
    let spoilerLevel: GalleryImageCard["spoilerLevel"];
    if (!isLoggedIn) {
      spoilerLevel = "unstarted";
    } else {
      const currentChapter = progressByBookId.get(image.bookId);
      if (currentChapter === undefined) {
        spoilerLevel = "unstarted";
      } else if (currentChapter >= image.chapterNumberAtTime) {
        spoilerLevel = "none";
      } else {
        spoilerLevel = "chapter";
      }
    }

    return {
      id: image.id,
      imageUrl: image.imageUrl,
      userPrompt: image.userPrompt,
      fullPrompt: image.fullPrompt,
      chapterNumberAtTime: image.chapterNumberAtTime,
      createdAt: image.createdAt.toISOString(),
      likeCount: image.likeCount,
      bookId: image.bookId,
      bookTitle: image.book.title,
      bookAuthor: image.book.author,
      userName: image.user.name,
      spoilerLevel,
    };
  });

  return (
    <GalleryClient
      images={cards}
      userLibraryBookIds={userLibraryBookIds}
      isLoggedIn={isLoggedIn}
    />
  );
}
