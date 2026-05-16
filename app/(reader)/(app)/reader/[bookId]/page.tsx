import { Suspense } from "react";
import { ReaderClient } from "./reader-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserUsageSummary } from "@/lib/subscription";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const metadata = {
  title: "Reader | NovelViz",
};

export default async function ReaderBookPage({ params }: PageProps) {
  const { bookId } = await params;

  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
    },
  });
  if (!book) {
    notFound();
  }

  const existingUserBook = await prisma.userBook.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId: book.id },
    },
  });
  if (!existingUserBook) {
    await prisma.userBook.create({
      data: { userId: dbUser.id, bookId: book.id, isActive: true },
    });
  } else if (!existingUserBook.isActive) {
    await prisma.userBook.update({
      where: { id: existingUserBook.id },
      data: { isActive: true },
    });
  }

  const chapters = await prisma.chapter.findMany({
    where: { bookId: book.id },
    orderBy: { sequenceNumber: "asc" },
    select: { id: true, sequenceNumber: true, title: true },
  });

  let currentProgress = await prisma.readingProgress.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId: book.id },
    },
  });

  if (!currentProgress) {
    const chapterOne = await prisma.chapter.findFirst({
      where: { bookId: book.id, sequenceNumber: 1 },
    });
    if (chapterOne) {
      currentProgress = await prisma.readingProgress.create({
        data: {
          userId: dbUser.id,
          bookId: book.id,
          currentChapterId: chapterOne.id,
          currentChapterNumber: 1,
        },
      });
    }
  }

  const initialProgress = currentProgress
    ? {
        currentChapterId: currentProgress.currentChapterId,
        currentChapterNumber: currentProgress.currentChapterNumber,
      }
    : null;

  return (
    <Suspense fallback={null}>
      <ReaderClient
        book={book}
        chapters={chapters}
        initialProgress={initialProgress}
        viewerRole={dbUser.role}
        usageSummary={await getUserUsageSummary(dbUser.id)}
      />
    </Suspense>
  );
}
