import { getCurrentUser } from "@/lib/auth";
import {
  compactChapterSequencesAfterDelete,
  syncReadingProgressChapterNumbers,
} from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Large books on production Neon can need more than the default 10s serverless limit. */
export const maxDuration = 60;

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

  await prisma.$transaction(
    async (tx) => {
      await tx.readingProgress.updateMany({
        where: { currentChapterId: chapterId },
        data: { currentChapterId: fallback.id },
      });
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
    { maxWait: 10_000, timeout: 120_000 },
  );

  try {
    await syncReadingProgressChapterNumbers(bookId);
  } catch (err) {
    console.error("[chapter-delete] syncReadingProgressChapterNumbers failed", {
      bookId,
      chapterId,
      err,
    });
  }

  return NextResponse.json({ ok: true });
}
