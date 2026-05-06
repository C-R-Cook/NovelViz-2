import { prisma } from "@/lib/prisma";
import { GENRE_LABELS } from "@/lib/genre";
import type { Prisma } from "@db";
import type { BookGenre } from "@db";
import { NextResponse } from "next/server";

const VALID_GENRES = new Set(Object.keys(GENRE_LABELS));

function parseGenre(value: string | null): BookGenre | undefined {
  if (!value || value === "all") return undefined;
  if (!VALID_GENRES.has(value)) return undefined;
  return value as BookGenre;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const genreRaw = url.searchParams.get("genre");
  const cursor = url.searchParams.get("cursor")?.trim() || null;
  const search = url.searchParams.get("search")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 50)
    : 20;

  if (genreRaw && genreRaw !== "all" && !VALID_GENRES.has(genreRaw)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const genre = parseGenre(genreRaw);
  const baseFilters: Prisma.BookWhereInput = {
    status: "published",
    deletedAt: null,
    ...(genre ? { genre } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { author: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const filters: Prisma.BookWhereInput[] = [baseFilters];
  if (cursor) {
    const cursorBook = await prisma.book.findFirst({
      where: { ...baseFilters, id: cursor },
      select: { id: true, title: true },
    });

    if (!cursorBook) {
      return NextResponse.json({ books: [], nextCursor: null });
    }

    filters.push({
      OR: [
        { title: { gt: cursorBook.title } },
        { AND: [{ title: cursorBook.title }, { id: { gt: cursorBook.id } }] },
      ],
    });
  }

  const where: Prisma.BookWhereInput =
    filters.length === 1 ? filters[0]! : { AND: filters };

  const rows = await prisma.book.findMany({
    where,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      author: true,
      genre: true,
      coverImageUrl: true,
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[limit - 1]!.id : null;
  const books = slice.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    coverImageUrl: book.coverImageUrl ?? "",
  }));

  return NextResponse.json({
    books,
    nextCursor,
  });
}
