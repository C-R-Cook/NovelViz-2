import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };
const ALL_STATUSES: BookStatus[] = [
  "draft",
  "pending_review",
  "rejected",
  "published",
  "unlisted",
  "processing",
  "ready_for_review",
];

const ALLOWED_TRANSITIONS: Record<BookStatus, BookStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["draft"],
  rejected: ["draft"],
  published: ["unlisted"],
  unlisted: ["published"],
  processing: [],
  ready_for_review: [],
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (existing.ownerId !== dbUser.id) {
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
  const data: {
    title?: string;
    author?: string;
    genre?: string | null;
    publishedYear?: number | null;
    description?: string | null;
    status?: BookStatus;
    rejectionReason?: string | null;
  } = {};

  if ("title" in b) {
    if (typeof b.title !== "string") {
      return NextResponse.json({ error: "title must be a string" }, { status: 400 });
    }
    data.title = b.title;
  }
  if ("author" in b) {
    if (typeof b.author !== "string") {
      return NextResponse.json({ error: "author must be a string" }, { status: 400 });
    }
    data.author = b.author;
  }
  if ("genre" in b) {
    if (b.genre !== null && typeof b.genre !== "string") {
      return NextResponse.json({ error: "genre must be a string or null" }, { status: 400 });
    }
    data.genre = b.genre === null || b.genre === "" ? null : b.genre;
  }
  if ("publishedYear" in b) {
    if (b.publishedYear === null || b.publishedYear === "") {
      data.publishedYear = null;
    } else if (typeof b.publishedYear === "number" && Number.isInteger(b.publishedYear)) {
      data.publishedYear = b.publishedYear;
    } else {
      return NextResponse.json(
        { error: "publishedYear must be an integer, null, or empty" },
        { status: 400 },
      );
    }
  }
  if ("description" in b) {
    if (b.description !== null && typeof b.description !== "string") {
      return NextResponse.json(
        { error: "description must be a string or null" },
        { status: 400 },
      );
    }
    data.description = b.description === null || b.description === "" ? null : b.description;
  }
  if ("status" in b) {
    if (typeof b.status !== "string") {
      return NextResponse.json({ error: "status must be a BookStatus" }, { status: 400 });
    }
    if (!(ALL_STATUSES as string[]).includes(b.status)) {
      return NextResponse.json({ error: "status must be a BookStatus" }, { status: 400 });
    }
    const next = b.status as BookStatus;
    if (next !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(next)) {
        return NextResponse.json(
          { error: `Forbidden status transition from ${existing.status} to ${next}` },
          { status: 403 },
        );
      }
    }
    data.status = next;
    if (next === "draft" && existing.status === "rejected") {
      data.rejectionReason = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: title, author, genre, publishedYear, description, status",
      },
      { status: 400 },
    );
  }

  const book = await prisma.book.update({
    where: { id },
    data,
    include: { _count: { select: { chapters: true } } },
  });

  return NextResponse.json({ book });
}
