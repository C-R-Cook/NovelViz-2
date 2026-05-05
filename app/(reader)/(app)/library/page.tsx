import { LibraryClient } from "./library-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "My Library | NovelViz",
};

export default async function LibraryPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const userBooks = await prisma.userBook.findMany({
    where: {
      userId: session.id,
      isActive: true,
      book: { deletedAt: null },
    },
    include: {
      book: {
        include: {
          _count: { select: { chapters: true } },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  const bookIds = userBooks.map((ub) => ub.bookId);

  const progressRows =
    bookIds.length === 0
      ? []
      : await prisma.readingProgress.findMany({
          where: { userId: session.id, bookId: { in: bookIds } },
          orderBy: { updatedAt: "desc" },
        });

  const progressByBookId = new Map(
    progressRows.map((p) => [
      p.bookId,
      { currentChapterNumber: p.currentChapterNumber },
    ]),
  );

  const rowByBookId = new Map(
    userBooks.map((ub) => {
      const book = ub.book;
      return [
        book.id,
        {
          userBookId: ub.id,
          bookId: book.id,
          title: book.title,
          author: book.author,
          genre: book.genre as string | null,
          coverImageUrl: book.coverImageUrl,
          chapterTotal: book._count.chapters,
          progress: progressByBookId.get(book.id) ?? null,
          removedFromCatalogue: book.status === "unlisted",
        },
      ];
    }),
  );

  const readingBooks = progressRows
    .map((p) => rowByBookId.get(p.bookId))
    .filter((row): row is NonNullable<typeof row> => row != null);

  const readingIds = new Set(readingBooks.map((b) => b.bookId));
  const gridBooks = userBooks
    .map((ub) => rowByBookId.get(ub.book.id))
    .filter((row): row is NonNullable<typeof row> => row != null && !readingIds.has(row.bookId));

  const totalCount = userBooks.length;

  return (
    <LibraryClient readingBooks={readingBooks} gridBooks={gridBooks} totalCount={totalCount} />
  );
}
