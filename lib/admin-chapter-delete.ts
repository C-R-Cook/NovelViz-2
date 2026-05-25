import {
  compactChapterSequencesAfterDelete,
  deleteChunksForChapterInBatches,
  syncReadingProgressChapterNumbers,
} from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@db";

export type ChapterListRow = {
  id: string;
  sequenceNumber: number;
  title: string | null;
  rawText: string;
  chunkCount: number;
};

export class ChapterDeleteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function mapChapterRow(
  c: {
    id: string;
    sequenceNumber: number;
    title: string | null;
    rawText: string;
    _count: { chunks: number };
  },
): ChapterListRow {
  return {
    id: c.id,
    sequenceNumber: c.sequenceNumber,
    title: c.title,
    rawText: c.rawText,
    chunkCount: c._count.chunks,
  };
}

export async function listBookChaptersForAdmin(bookId: string): Promise<ChapterListRow[]> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
    include: { _count: { select: { chunks: true } } },
  });
  return chapters.map(mapChapterRow);
}

function prismaDeleteError(err: unknown): ChapterDeleteError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003" || err.code === "P2014") {
      return new ChapterDeleteError(
        "Cannot delete this chapter while a reader is still on it. Refresh and try again.",
        409,
      );
    }
    if (err.code === "P2028") {
      return new ChapterDeleteError(
        "Delete timed out — this chapter has many search chunks. Wait and try again.",
        504,
      );
    }
  }
  const message = err instanceof Error ? err.message : "Chapter delete failed";
  return new ChapterDeleteError(message, 500);
}

/** Delete one chapter; returns updated chapter list for the book. */
export async function deleteBookChapter(bookId: string, chapterId: string): Promise<ChapterListRow[]> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
  });
  if (!chapter) {
    throw new ChapterDeleteError("Chapter not found", 404);
  }

  const count = await prisma.chapter.count({ where: { bookId } });
  if (count <= 1) {
    throw new ChapterDeleteError("Cannot delete the only chapter for this book", 400);
  }

  const prev = await prisma.chapter.findFirst({
    where: { bookId, sequenceNumber: { lt: chapter.sequenceNumber } },
    orderBy: { sequenceNumber: "desc" },
  });
  const next = await prisma.chapter.findFirst({
    where: { bookId, sequenceNumber: { gt: chapter.sequenceNumber } },
    orderBy: { sequenceNumber: "asc" },
  });
  const fallback = prev ?? next;
  if (!fallback) {
    throw new ChapterDeleteError("No fallback chapter", 400);
  }

  const deletedSequenceNumber = chapter.sequenceNumber;

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.readingProgress.updateMany({
          where: { currentChapterId: chapterId },
          data: { currentChapterId: fallback.id },
        });
        await deleteChunksForChapterInBatches(chapterId, tx);
        await tx.chapter.delete({ where: { id: chapterId } });
        await compactChapterSequencesAfterDelete(bookId, deletedSequenceNumber, tx);

        const fallbackAfter = await tx.chapter.findUnique({
          where: { id: fallback.id },
          select: { sequenceNumber: true },
        });
        if (fallbackAfter) {
          await tx.readingProgress.updateMany({
            where: { currentChapterId: fallback.id },
            data: { currentChapterNumber: fallbackAfter.sequenceNumber },
          });
        }
      },
      { maxWait: 15_000, timeout: 110_000 },
    );
  } catch (err) {
    console.error("[chapter-delete] failed", { bookId, chapterId, err });
    throw prismaDeleteError(err) ?? new ChapterDeleteError("Chapter delete failed", 500);
  }

  try {
    await syncReadingProgressChapterNumbers(bookId);
  } catch (err) {
    console.error("[chapter-delete] syncReadingProgressChapterNumbers failed", { bookId, chapterId, err });
  }

  return listBookChaptersForAdmin(bookId);
}

const BULK_DELETE_MAX = 40;

export type BulkChapterDeleteResult = {
  deletedCount: number;
  failed: Array<{ chapterId: string; error: string }>;
  chapters: ChapterListRow[];
};

/** Deletes chapters highest sequence first; leaves at least one chapter on the book. */
export async function deleteBookChaptersBulk(
  bookId: string,
  chapterIds: string[],
): Promise<BulkChapterDeleteResult> {
  const uniqueIds = [...new Set(chapterIds.filter((id) => typeof id === "string" && id.trim()))];
  if (uniqueIds.length === 0) {
    throw new ChapterDeleteError("Provide at least one chapterId", 400);
  }
  if (uniqueIds.length > BULK_DELETE_MAX) {
    throw new ChapterDeleteError(`Delete at most ${BULK_DELETE_MAX} chapters per request`, 400);
  }

  const all = await prisma.chapter.findMany({
    where: { bookId },
    select: { id: true, sequenceNumber: true },
  });
  const bookChapterIds = new Set(all.map((c) => c.id));
  const toDelete = uniqueIds
    .filter((id) => bookChapterIds.has(id))
    .map((id) => {
      const row = all.find((c) => c.id === id)!;
      return { id, sequenceNumber: row.sequenceNumber };
    })
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber);

  if (toDelete.length === 0) {
    throw new ChapterDeleteError("No matching chapters for this book", 400);
  }

  if (all.length - toDelete.length < 1) {
    throw new ChapterDeleteError("Cannot delete every chapter — at least one must remain", 400);
  }

  const failed: Array<{ chapterId: string; error: string }> = [];
  let deletedCount = 0;

  for (const row of toDelete) {
    try {
      await deleteBookChapter(bookId, row.id);
      deletedCount += 1;
    } catch (err) {
      const message =
        err instanceof ChapterDeleteError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed";
      failed.push({ chapterId: row.id, error: message });
    }
  }

  const chapters = await listBookChaptersForAdmin(bookId);
  return { deletedCount, failed, chapters };
}
