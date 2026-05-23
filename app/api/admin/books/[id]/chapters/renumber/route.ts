import { getCurrentUser } from "@/lib/auth";
import { renumberChapters, syncReadingProgressChapterNumbers } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

/** Reassign chapter sequence numbers to 1…n (creation order). Fixes gaps after a failed delete. */
export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true, status: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && book.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (book.status === "processing") {
    return NextResponse.json(
      { error: "Cannot renumber chapters while ingestion is running" },
      { status: 400 },
    );
  }

  await renumberChapters(bookId);
  await syncReadingProgressChapterNumbers(bookId);

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
