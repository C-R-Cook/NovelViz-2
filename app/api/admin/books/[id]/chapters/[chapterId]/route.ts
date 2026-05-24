import { getCurrentUser } from "@/lib/auth";
import {
  compactChapterSequencesAfterDelete,
  deleteChunksForChapterInBatches,
  syncReadingProgressChapterNumbers,
} from "@/lib/ingestion";
import { Prisma } from "@db";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Large books on production Neon can need more than the default 10s serverless limit. */
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string; chapterId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId, chapterId } = await context.params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && book.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: { title?: string | null; rawText?: string } = {};

  if ("title" in b) {
    if (b.title !== null && typeof b.title !== "string") {
      return NextResponse.json({ error: "title must be a string or null" }, { status: 400 });
    }
    data.title = b.title === "" ? null : (b.title as string | null);
  }
  if ("rawText" in b) {
    if (typeof b.rawText !== "string") {
      return NextResponse.json({ error: "rawText must be a string" }, { status: 400 });
    }
    data.rawText = b.rawText;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Provide title and/or rawText" },
      { status: 400 },
    );
  }

  const existing = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data,
  });

  return NextResponse.json({ chapter });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId, chapterId } = await context.params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && book.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
  });
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  const count = await prisma.chapter.count({ where: { bookId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only chapter for this book" },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "No fallback chapter" }, { status: 400 });
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
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003" || err.code === "P2014") {
        return NextResponse.json(
          {
            error:
              "Cannot delete this chapter while a reader is still on it. Refresh the page and try again.",
          },
          { status: 409 },
        );
      }
      if (err.code === "P2028") {
        return NextResponse.json(
          {
            error:
              "Delete timed out — this chapter has many search chunks. Wait a moment and try again, or merge chapters instead.",
          },
          { status: 504 },
        );
      }
    }
    const message = err instanceof Error ? err.message : "Chapter delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await syncReadingProgressChapterNumbers(bookId);
  } catch (err) {
    console.error("[chapter-delete] syncReadingProgressChapterNumbers failed", {
      bookId,
      chapterId,
      err,
    });
  }

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
    include: { _count: { select: { chunks: true } } },
  });

  return NextResponse.json({
    ok: true,
    chapters: chapters.map((c) => ({
      id: c.id,
      sequenceNumber: c.sequenceNumber,
      title: c.title,
      rawText: c.rawText,
      chunkCount: c._count.chunks,
    })),
  });
}
