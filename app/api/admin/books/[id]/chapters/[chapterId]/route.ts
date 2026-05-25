import { getCurrentUser } from "@/lib/auth";
import {
  ChapterDeleteError,
  deleteBookChapter,
  listBookChaptersForAdmin,
} from "@/lib/admin-chapter-delete";
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

  try {
    const chapters = await deleteBookChapter(bookId, chapterId);
    return NextResponse.json({ ok: true, chapters });
  } catch (err) {
    if (err instanceof ChapterDeleteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[chapter-delete] failed", { bookId, chapterId, err });
    const message = err instanceof Error ? err.message : "Chapter delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
