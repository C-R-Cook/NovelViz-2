import {
  PARTNER_BOOKS_PAGE_SIZE,
  queryPartnerBooksPage,
} from "@/lib/partner-books-list";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookGenre, BookStatus, UserRole } from "@db";
import { NextResponse } from "next/server";

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

/** Paginated list of the caller’s owned books (non-deleted only). Partners and admins allowed. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === UserRole.reader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const skipRaw = url.searchParams.get("skip");
  const parsed = skipRaw === null || skipRaw === "" ? 0 : Number.parseInt(skipRaw, 10);
  const skip = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

  const { rows, hasMore } = await queryPartnerBooksPage({
    ownerId: dbUser.id,
    skip,
  });

  return NextResponse.json({
    books: rows,
    hasMore,
    pageSize: PARTNER_BOOKS_PAGE_SIZE,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === UserRole.reader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
  if (typeof b.title !== "string" || b.title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof b.author !== "string" || b.author.trim() === "") {
    return NextResponse.json({ error: "author is required" }, { status: 400 });
  }

  let publishedYear: number | null = null;
  if ("publishedYear" in b && b.publishedYear !== null) {
    if (typeof b.publishedYear === "number" && Number.isInteger(b.publishedYear)) {
      publishedYear = b.publishedYear;
    } else {
      return NextResponse.json(
        { error: "publishedYear must be an integer or null" },
        { status: 400 },
      );
    }
  }

  let genre: BookGenre | null = null;
  if ("genre" in b && b.genre !== null && b.genre !== "") {
    if (typeof b.genre !== "string" || !(ALL_GENRES as string[]).includes(b.genre)) {
      return NextResponse.json({ error: "genre must be a BookGenre or null" }, { status: 400 });
    }
    genre = b.genre as BookGenre;
  }

  const confirmDuplicate = b.confirmDuplicate === true;
  if (!confirmDuplicate) {
    const existingBook = await prisma.book.findFirst({
      where: {
        deletedAt: null,
        title: { equals: b.title.trim(), mode: "insensitive" },
        author: { equals: b.author.trim(), mode: "insensitive" },
      },
      select: { id: true, title: true, author: true, status: true },
    });
    if (existingBook) {
      return NextResponse.json({
        duplicateWarning: true,
        existingBook: {
          id: existingBook.id,
          title: existingBook.title,
          author: existingBook.author,
          status: existingBook.status,
        },
        message: "A book with this title and author already exists in the catalogue.",
      });
    }
  }

  const book = await prisma.book.create({
    data: {
      title: b.title.trim(),
      author: b.author.trim(),
      genre,
      publishedYear,
      description:
        typeof b.description === "string" && b.description.trim()
          ? b.description.trim()
          : null,
      ownerId: dbUser.id,
      status: BookStatus.draft,
      isPublicDomain: false,
    },
  });

  return NextResponse.json({ book });
}
