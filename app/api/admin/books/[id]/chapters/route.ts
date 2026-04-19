import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

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
