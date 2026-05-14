import { LibraryClient } from "./library-client";
import type { LibraryBookRow } from "./library-types";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "My Library | NovelViz",
};

function formatRelativeLastRead(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffSec) < 45) return rtf.format(0, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 60) return rtf.format(-diffDay, "day");
  const diffWeek = Math.round(diffDay / 7);
  if (Math.abs(diffWeek) < 52) return rtf.format(-diffWeek, "week");
  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(-diffMonth, "month");
}

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
        });

  const progressByBookId = new Map(
    progressRows.map((p) => [
      p.bookId,
      {
        currentChapterNumber: p.currentChapterNumber,
        updatedAt: p.updatedAt.toISOString(),
      },
    ]),
  );

  const [queryGroup, imageGroup, queryRowsForLast, totalQueries, totalImages] =
    bookIds.length === 0
      ? [[], [], [], 0, 0]
      : await Promise.all([
          prisma.query.groupBy({
            by: ["bookId"],
            where: { userId: session.id, bookId: { in: bookIds } },
            _count: true,
          }),
          prisma.generatedImage.groupBy({
            by: ["bookId"],
            where: { userId: session.id, bookId: { in: bookIds } },
            _count: true,
          }),
          prisma.query.findMany({
            where: { userId: session.id, bookId: { in: bookIds } },
            orderBy: { createdAt: "desc" },
            select: { bookId: true, questionText: true },
          }),
          prisma.query.count({
            where: { userId: session.id, bookId: { in: bookIds } },
          }),
          prisma.generatedImage.count({
            where: { userId: session.id, bookId: { in: bookIds } },
          }),
        ]);

  const queryCountByBook = new Map(queryGroup.map((g) => [g.bookId, g._count]));
  const imageCountByBook = new Map(imageGroup.map((g) => [g.bookId, g._count]));

  const lastQuestionByBook = new Map<string, string>();
  for (const row of queryRowsForLast) {
    if (!lastQuestionByBook.has(row.bookId)) {
      lastQuestionByBook.set(row.bookId, row.questionText);
    }
  }

  const rowByBookId = new Map<string, LibraryBookRow>(
    userBooks.map((ub) => {
      const book = ub.book;
      const prog = progressByBookId.get(book.id) ?? null;
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
          progress: prog,
          removedFromCatalogue: book.status === "unlisted",
          queryCount: queryCountByBook.get(book.id) ?? 0,
          imageCount: imageCountByBook.get(book.id) ?? 0,
          lastQuestion: lastQuestionByBook.get(book.id) ?? null,
          lastReadLabel: formatRelativeLastRead(prog?.updatedAt ?? null),
        },
      ];
    }),
  );

  const withProgress = userBooks
    .filter((ub) => progressByBookId.has(ub.bookId))
    .sort((a, b) => {
      const ta = progressByBookId.get(a.bookId)!.updatedAt;
      const tb = progressByBookId.get(b.bookId)!.updatedAt;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

  const withoutProgress = userBooks.filter((ub) => !progressByBookId.has(ub.bookId));

  const orderedUserBooks = [...withProgress, ...withoutProgress];

  const books: LibraryBookRow[] = orderedUserBooks
    .map((ub) => rowByBookId.get(ub.book.id))
    .filter((row): row is LibraryBookRow => row != null);

  const defaultActiveBookId = books[0]?.bookId ?? "";
  const totalCount = userBooks.length;

  return (
    <LibraryClient
      books={books}
      totals={{ books: totalCount, queries: totalQueries, images: totalImages }}
      defaultActiveBookId={defaultActiveBookId}
    />
  );
}
