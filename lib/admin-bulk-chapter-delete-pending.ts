import {
  ChapterDeleteError,
  deleteBookChaptersBulk,
} from "@/lib/admin-chapter-delete";
import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";

export const BULK_CHAPTER_TITLE_QUERY_MAX = 80;
export const BULK_CHAPTER_DELETE_BOOKS_MAX = 25;

export type PendingReviewChapterMatch = {
  chapterId: string;
  sequenceNumber: number;
  title: string | null;
  chunkCount: number;
};

export type PendingReviewBookChapterSearchRow = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  status: BookStatus;
  totalChapterCount: number;
  matches: PendingReviewChapterMatch[];
  /** True when every chapter on the book matches — bulk delete would be blocked. */
  wouldDeleteAllChapters: boolean;
};

export type CrossBookBulkChapterDeleteBookResult = {
  bookId: string;
  bookTitle: string;
  deletedCount: number;
  failed: Array<{ chapterId: string; error: string }>;
  skipped?: string;
};

export type CrossBookBulkChapterDeleteResult = {
  titleQuery: string;
  booksProcessed: number;
  chaptersDeleted: number;
  results: CrossBookBulkChapterDeleteBookResult[];
};

export function normalizeChapterTitleQuery(raw: string): string {
  const q = raw.trim();
  if (!q) {
    throw new ChapterDeleteError("Enter a word or phrase to search chapter titles", 400);
  }
  if (q.length > BULK_CHAPTER_TITLE_QUERY_MAX) {
    throw new ChapterDeleteError(
      `Search phrase must be at most ${BULK_CHAPTER_TITLE_QUERY_MAX} characters`,
      400,
    );
  }
  return q;
}

export async function searchPendingReviewBooksByChapterTitle(
  rawQuery: string,
): Promise<{ titleQuery: string; books: PendingReviewBookChapterSearchRow[] }> {
  const titleQuery = normalizeChapterTitleQuery(rawQuery);

  const chapters = await prisma.chapter.findMany({
    where: {
      book: { status: "pending_review", deletedAt: null },
      title: { contains: titleQuery, mode: "insensitive" },
    },
    orderBy: [{ book: { title: "asc" } }, { sequenceNumber: "asc" }],
    select: {
      id: true,
      bookId: true,
      sequenceNumber: true,
      title: true,
      book: { select: { title: true, author: true, status: true } },
      _count: { select: { chunks: true } },
    },
  });

  if (chapters.length === 0) {
    return { titleQuery, books: [] };
  }

  const bookIds = [...new Set(chapters.map((c) => c.bookId))];
  const totals = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, _count: { select: { chapters: true } } },
  });
  const totalByBookId = new Map(totals.map((b) => [b.id, b._count.chapters]));

  const byBook = new Map<string, PendingReviewBookChapterSearchRow>();

  for (const ch of chapters) {
    let row = byBook.get(ch.bookId);
    if (!row) {
      const totalChapterCount = totalByBookId.get(ch.bookId) ?? 0;
      row = {
        bookId: ch.bookId,
        bookTitle: ch.book.title,
        bookAuthor: ch.book.author,
        status: ch.book.status,
        totalChapterCount,
        matches: [],
        wouldDeleteAllChapters: false,
      };
      byBook.set(ch.bookId, row);
    }
    row.matches.push({
      chapterId: ch.id,
      sequenceNumber: ch.sequenceNumber,
      title: ch.title,
      chunkCount: ch._count.chunks,
    });
  }

  const books = [...byBook.values()].map((row) => ({
    ...row,
    wouldDeleteAllChapters:
      row.totalChapterCount > 0 && row.matches.length >= row.totalChapterCount,
  }));

  return { titleQuery, books };
}

export async function deleteMatchingChaptersAcrossPendingReviewBooks(
  rawBookIds: string[],
  rawQuery: string,
): Promise<CrossBookBulkChapterDeleteResult> {
  const titleQuery = normalizeChapterTitleQuery(rawQuery);
  const uniqueBookIds = [...new Set(rawBookIds.filter((id) => typeof id === "string" && id.trim()))];
  if (uniqueBookIds.length === 0) {
    throw new ChapterDeleteError("Select at least one book", 400);
  }
  if (uniqueBookIds.length > BULK_CHAPTER_DELETE_BOOKS_MAX) {
    throw new ChapterDeleteError(
      `Delete from at most ${BULK_CHAPTER_DELETE_BOOKS_MAX} books per request`,
      400,
    );
  }

  const books = await prisma.book.findMany({
    where: { id: { in: uniqueBookIds }, deletedAt: null },
    select: { id: true, title: true, status: true },
  });
  const bookById = new Map(books.map((b) => [b.id, b]));

  const results: CrossBookBulkChapterDeleteBookResult[] = [];
  let chaptersDeleted = 0;
  let booksProcessed = 0;

  for (const bookId of uniqueBookIds) {
    const book = bookById.get(bookId);
    if (!book) {
      results.push({
        bookId,
        bookTitle: "(unknown)",
        deletedCount: 0,
        failed: [],
        skipped: "Book not found",
      });
      continue;
    }

    if (book.status === "processing") {
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: 0,
        failed: [],
        skipped: "Ingestion in progress",
      });
      continue;
    }

    if (book.status !== "pending_review") {
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: 0,
        failed: [],
        skipped: "Book is not pending review",
      });
      continue;
    }

    const matching = await prisma.chapter.findMany({
      where: {
        bookId,
        title: { contains: titleQuery, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (matching.length === 0) {
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: 0,
        failed: [],
        skipped: "No matching chapters",
      });
      continue;
    }

    const total = await prisma.chapter.count({ where: { bookId } });
    if (total - matching.length < 1) {
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: 0,
        failed: [],
        skipped: "Would delete every chapter — skipped",
      });
      continue;
    }

    booksProcessed += 1;
    try {
      const bulk = await deleteBookChaptersBulk(
        bookId,
        matching.map((c) => c.id),
      );
      chaptersDeleted += bulk.deletedCount;
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: bulk.deletedCount,
        failed: bulk.failed,
      });
    } catch (err) {
      const message =
        err instanceof ChapterDeleteError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed";
      results.push({
        bookId,
        bookTitle: book.title,
        deletedCount: 0,
        failed: [],
        skipped: message,
      });
    }
  }

  return { titleQuery, booksProcessed, chaptersDeleted, results };
}
