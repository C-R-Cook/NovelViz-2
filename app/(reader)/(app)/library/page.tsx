import { LibraryClient } from "./library-client";
import type { LibraryBookRow, LibraryChapter } from "./library-types";
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

type LibraryPageProps = {
  searchParams?: Promise<{
    book?: string | string[];
    tab?: string | string[];
    q?: string | string[];
  }>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const sp = searchParams ? await searchParams : {};
  const requestedBookId = firstParam(sp.book);
  const initialTabRaw = firstParam(sp.tab);
  const initialTab =
    initialTabRaw === "ask" || initialTabRaw === "imagine" ? initialTabRaw : undefined;
  const initialQuestion = firstParam(sp.q);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const viewerRole =
    dbUser.role === "partner" ? "partner" : dbUser.role === "admin" ? "admin" : "reader";

  if (requestedBookId) {
    const publishedBook = await prisma.book.findFirst({
      where: {
        id: requestedBookId,
        status: "published",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (publishedBook) {
      await prisma.userBook.upsert({
        where: {
          userId_bookId: { userId: session.id, bookId: requestedBookId },
        },
        create: {
          userId: session.id,
          bookId: requestedBookId,
          isActive: true,
        },
        update: {
          isActive: true,
        },
      });
    }
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

  const [progressRows, chapterRows, statsBundle] = await Promise.all([
    bookIds.length === 0
      ? Promise.resolve([])
      : prisma.readingProgress.findMany({
          where: { userId: session.id, bookId: { in: bookIds } },
        }),
    bookIds.length === 0
      ? Promise.resolve([])
      : prisma.chapter.findMany({
          where: { bookId: { in: bookIds } },
          orderBy: { sequenceNumber: "asc" },
          select: { id: true, bookId: true, sequenceNumber: true, title: true },
        }),
    bookIds.length === 0
      ? Promise.resolve([[], [], [], 0, 0] as const)
      : Promise.all([
          prisma.userBook.updateMany({
            where: { userId: session.id, bookId: { in: bookIds }, isActive: false },
            data: { isActive: true },
          }).then(() => [] as const),
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
        ]).then(([, queryGroup, imageGroup, queryRowsForLast, totalQueries, totalImages]) =>
          [queryGroup, imageGroup, queryRowsForLast, totalQueries, totalImages] as const,
        ),
  ]);

  const progressByBookId = new Map(
    progressRows.map((p) => [
      p.bookId,
      {
        currentChapterId: p.currentChapterId,
        currentChapterNumber: p.currentChapterNumber,
        updatedAt: p.updatedAt.toISOString(),
      },
    ]),
  );

  const chaptersByBookId = new Map<string, LibraryChapter[]>();
  for (const ch of chapterRows) {
    const list = chaptersByBookId.get(ch.bookId) ?? [];
    list.push({
      id: ch.id,
      sequenceNumber: ch.sequenceNumber,
      title: ch.title,
    });
    chaptersByBookId.set(ch.bookId, list);
  }

  const [queryGroup, imageGroup, queryRowsForLast, totalQueries, totalImages] = statsBundle;

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
          chapters: chaptersByBookId.get(book.id) ?? [],
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

  const withoutProgress = [...userBooks.filter((ub) => !progressByBookId.has(ub.bookId))].sort(
    (a, b) => a.addedAt.getTime() - b.addedAt.getTime(),
  );

  const orderedUserBooks = [...withProgress, ...withoutProgress];

  const books: LibraryBookRow[] = orderedUserBooks
    .map((ub) => rowByBookId.get(ub.book.id))
    .filter((row): row is LibraryBookRow => row != null);

  const bookIdSet = new Set(books.map((b) => b.bookId));

  let defaultActiveBookId = "";
  if (requestedBookId && bookIdSet.has(requestedBookId)) {
    defaultActiveBookId = requestedBookId;
  } else if (withProgress[0]) {
    defaultActiveBookId = withProgress[0].bookId;
  } else if (withoutProgress[0]) {
    defaultActiveBookId = withoutProgress[0].bookId;
  } else {
    defaultActiveBookId = books[0]?.bookId ?? "";
  }

  return (
    <LibraryClient
      books={books}
      totals={{ books: userBooks.length, queries: totalQueries, images: totalImages }}
      defaultActiveBookId={defaultActiveBookId}
      viewerRole={viewerRole}
      initialTab={initialTab}
      initialQuestion={initialQuestion}
    />
  );
}
