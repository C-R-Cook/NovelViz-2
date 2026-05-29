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
    openLibraryKey?: string | null;
    gutenbergId?: number | null;
    internalNotes?: string | null;
    ownerId?: string | null;
    deletedAt?: null;
    status?: BookStatus;
    coverGenAttemptsGranted?: number;
    coverGenAttemptsConsumed?: number;
  } = {};

  let coverQuotaAdminTouched = false;

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
  if ("openLibraryKey" in b) {
    if (b.openLibraryKey !== null && typeof b.openLibraryKey !== "string") {
      return NextResponse.json(
        { error: "openLibraryKey must be a string or null" },
        { status: 400 },
      );
    }
    const trimmed = typeof b.openLibraryKey === "string" ? b.openLibraryKey.trim() : "";
    data.openLibraryKey = trimmed === "" ? null : trimmed;
  }
  if ("gutenbergId" in b) {
    if (b.gutenbergId === null || b.gutenbergId === "") {
      data.gutenbergId = null;
    } else if (typeof b.gutenbergId === "number" && Number.isInteger(b.gutenbergId) && b.gutenbergId > 0) {
      data.gutenbergId = b.gutenbergId;
    } else {
      return NextResponse.json(
        { error: "gutenbergId must be a positive integer, null, or empty" },
        { status: 400 },
      );
    }
  }
  if ("internalNotes" in b) {
    if (b.internalNotes !== null && typeof b.internalNotes !== "string") {
      return NextResponse.json(
        { error: "internalNotes must be a string or null" },
        { status: 400 },
      );
    }
    const trimmed =
      typeof b.internalNotes === "string" ? b.internalNotes.trim() : "";
    data.internalNotes = trimmed === "" ? null : trimmed;
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

  if ("coverGenAttemptsGranted" in b || "coverGenAttemptsGrantedDelta" in b) {
    if (user.role !== UserRole.admin) {
      return NextResponse.json(
        { error: "Only admins can change cover generation allowance" },
        { status: 403 },
      );
    }
    if ("coverGenAttemptsGrantedDelta" in b) {
      const d = b.coverGenAttemptsGrantedDelta;
      if (typeof d !== "number" || !Number.isInteger(d)) {
        return NextResponse.json(
          { error: "coverGenAttemptsGrantedDelta must be an integer" },
          { status: 400 },
        );
      }
      const current = await prisma.book.findUnique({
        where: { id },
        select: { coverGenAttemptsGranted: true },
      });
      const base = current?.coverGenAttemptsGranted ?? 0;
      const next = Math.max(0, base + d);
      data.coverGenAttemptsGranted = next;
      coverQuotaAdminTouched = true;
    } else if ("coverGenAttemptsGranted" in b) {
      const v = b.coverGenAttemptsGranted;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return NextResponse.json(
          { error: "coverGenAttemptsGranted must be a non-negative integer" },
          { status: 400 },
        );
      }
      data.coverGenAttemptsGranted = v;
      coverQuotaAdminTouched = true;
    }
  }

  if ("resetCoverGenQuota" in b) {
    if (user.role !== UserRole.admin) {
      return NextResponse.json(
        { error: "Only admins can reset cover generation allowance" },
        { status: 403 },
      );
    }
    if (b.resetCoverGenQuota !== true) {
      return NextResponse.json({ error: "resetCoverGenQuota must be true" }, { status: 400 });
    }
    data.coverGenAttemptsConsumed = 0;
    coverQuotaAdminTouched = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: title, author, genre, publishedYear, description, openLibraryKey, gutenbergId, internalNotes, ownerId, restoreDeleted, coverGenAttemptsGranted, coverGenAttemptsGrantedDelta, resetCoverGenQuota",
      },
      { status: 400 },
    );
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data,
    });
    if (coverQuotaAdminTouched) {
      await prisma.coverAiQuotaRequest.updateMany({
        where: { bookId: id, handledAt: null },
        data: { handledAt: new Date() },
      });
    }
    return NextResponse.json({ book });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "That Gutenberg ID is already used by another book" },
        { status: 409 },
      );
    }
    throw err;
  }
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
