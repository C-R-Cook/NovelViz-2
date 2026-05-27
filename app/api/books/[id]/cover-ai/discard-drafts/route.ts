import { getCurrentUser } from "@/lib/auth";
import {
  canAccessBookCoverAi,
  isCoverAiDraftPublicIdForBook,
} from "@/lib/cover-ai-access";
import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  let body: { publicIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const list = body.publicIds;
  const publicIds =
    Array.isArray(list) && list.every((x) => typeof x === "string")
      ? (list as string[]).map((s) => s.trim()).filter(Boolean)
      : [];

  if (publicIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (!canAccessBookCoverAi(dbUser.role, dbUser.id, book)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const pid of publicIds) {
    if (!isCoverAiDraftPublicIdForBook(bookId, pid)) {
      return NextResponse.json({ error: "Invalid draft id" }, { status: 400 });
    }
  }

  let deleted = 0;
  for (const pid of publicIds) {
    try {
      const r = await cloudinary.uploader.destroy(pid, { resource_type: "image" });
      if (r.result === "ok" || r.result === "not found") deleted += 1;
    } catch {
      // continue
    }
  }

  return NextResponse.json({ ok: true, deleted });
}
