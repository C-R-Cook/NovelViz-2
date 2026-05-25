import { getCurrentUser } from "@/lib/auth";
import {
  ChapterDeleteError,
  deleteBookChaptersBulk,
} from "@/lib/admin-chapter-delete";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
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

  const chapterIds = (body as { chapterIds?: unknown }).chapterIds;
  if (!Array.isArray(chapterIds)) {
    return NextResponse.json({ error: "chapterIds must be an array" }, { status: 400 });
  }

  try {
    const result = await deleteBookChaptersBulk(bookId, chapterIds as string[]);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ChapterDeleteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[bulk-chapter-delete] failed", { bookId, err });
    const message = err instanceof Error ? err.message : "Bulk delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
