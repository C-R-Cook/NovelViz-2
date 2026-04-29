import { getCurrentUser } from "@/lib/auth";
import {
  renumberChapters,
  syncReadingProgressChapterNumbers,
} from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
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
  const sourceChapterId = b.sourceChapterId;
  const targetChapterId = b.targetChapterId;
  const mode = b.mode;

  if (typeof sourceChapterId !== "string" || typeof targetChapterId !== "string") {
    return NextResponse.json(
      { error: "sourceChapterId and targetChapterId are required" },
      { status: 400 },
    );
  }
  if (sourceChapterId === targetChapterId) {
    return NextResponse.json(
      { error: "source and target must differ" },
      { status: 400 },
    );
  }
  if (mode !== "prepend" && mode !== "append") {
    return NextResponse.json(
      { error: "mode must be 'prepend' or 'append'" },
      { status: 400 },
    );
  }

  const source = await prisma.chapter.findFirst({
    where: { id: sourceChapterId, bookId },
  });
  const target = await prisma.chapter.findFirst({
    where: { id: targetChapterId, bookId },
  });

  if (!source || !target) {
    return NextResponse.json(
      { error: "Source or target chapter not found" },
      { status: 404 },
    );
  }

  const merged =
    mode === "prepend"
      ? `${source.rawText}\n\n${target.rawText}`
      : `${target.rawText}\n\n${source.rawText}`;

  await prisma.$transaction(async (tx) => {
    await tx.chapter.update({
      where: { id: target.id },
      data: { rawText: merged },
    });

    await tx.readingProgress.updateMany({
      where: { currentChapterId: source.id },
      data: { currentChapterId: target.id },
    });

    await tx.chapter.delete({ where: { id: source.id } });
  });

  await renumberChapters(bookId);
  await syncReadingProgressChapterNumbers(bookId);

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
    include: {
      _count: { select: { chunks: true } },
    },
  });

  return NextResponse.json({
    chapters: chapters.map((c) => ({
      id: c.id,
      sequenceNumber: c.sequenceNumber,
      title: c.title,
      rawText: c.rawText,
      chunkCount: c._count.chunks,
    })),
  });
}
