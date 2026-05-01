import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookGenre, BookStatus, UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };
const ALL_GENRES: BookGenre[] = [
  "fantasy",
  "horror",
  "romance",
  "adventure",
  "mystery",
  "science_fiction",
  "historical_fiction",
  "literary_fiction",
  "thriller",
  "childrens_fiction",
  "classic_literature",
  "gothic",
  "crime",
  "biography",
  "short_stories",
];

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const { id } = await context.params;
  const wantsRestore = b.restoreDeleted === true;
  const existingBook = await prisma.book.findFirst({
    where: wantsRestore ? { id, deletedAt: { not: null } } : { id, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!existingBook) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && existingBook.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: {
    title?: string;
    author?: string;
    genre?: BookGenre | null;
    publishedYear?: number | null;
    description?: string | null;
    ownerId?: string | null;
    deletedAt?: null;
    status?: BookStatus;
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
    if (b.genre === null || b.genre === "") {
      data.genre = null;
    } else if (typeof b.genre === "string" && (ALL_GENRES as string[]).includes(b.genre)) {
      data.genre = b.genre as BookGenre;
    } else {
      return NextResponse.json({ error: "genre must be a BookGenre or null" }, { status: 400 });
    }
  }
  if ("publishedYear" in b) {
    if (b.publishedYear === null || b.publishedYear === "") {
      data.publishedYear = null;
    } else if (
      typeof b.publishedYear === "number" &&
      Number.isInteger(b.publishedYear)
    ) {
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
    data.description =
      b.description === null || b.description === "" ? null : b.description;
  }
  if ("ownerId" in b) {
    if (
      b.ownerId !== null &&
      b.ownerId !== "" &&
      typeof b.ownerId !== "string"
    ) {
      return NextResponse.json(
        { error: "ownerId must be a string, null, or empty" },
        { status: 400 },
      );
    }
    data.ownerId = b.ownerId === null || b.ownerId === "" ? null : b.ownerId;
  }
  if ("restoreDeleted" in b) {
    if (b.restoreDeleted !== true) {
      return NextResponse.json({ error: "restoreDeleted must be true" }, { status: 400 });
    }
    data.deletedAt = null;
    data.status = BookStatus.unlisted;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: title, author, genre, publishedYear, description, ownerId, restoreDeleted",
      },
      { status: 400 },
    );
  }

  const book = await prisma.book.update({
    where: { id },
    data,
  });
  return NextResponse.json({ book });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existingBook = await prisma.book.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!existingBook) {
    const alreadyDeleted = await prisma.book.findFirst({
      where: { id, deletedAt: { not: null } },
      select: { id: true, ownerId: true },
    });
    if (!alreadyDeleted) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (user.role !== UserRole.admin && alreadyDeleted.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  }
  if (user.role !== UserRole.admin && existingBook.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.book.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
