import {
  DISCOVER_PAGE_SIZE,
  getDiscoverBooksPage,
} from "@/lib/discover-catalogue";
import { GENRE_LABELS } from "@/lib/genre";
import type { BookGenre } from "@db";
import { NextResponse } from "next/server";

const VALID_GENRES = new Set(Object.keys(GENRE_LABELS));

function parseGenre(value: string | null): BookGenre | undefined {
  if (!value || value === "all") return undefined;
  if (!VALID_GENRES.has(value)) return undefined;
  return value as BookGenre;
}

/**
 * Public catalogue pagination for /discover.
 * Query: `genre` (optional, BookGenre or omit/`all`), `cursor` (optional, last book `id` from previous page).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const genreRaw = url.searchParams.get("genre");
  const cursor = url.searchParams.get("cursor")?.trim() || null;

  if (genreRaw && genreRaw !== "all" && !VALID_GENRES.has(genreRaw)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const genre = parseGenre(genreRaw);

  const { books, nextCursor } = await getDiscoverBooksPage({
    genre,
    cursor: cursor || undefined,
  });

  return NextResponse.json({
    books,
    nextCursor,
    pageSize: DISCOVER_PAGE_SIZE,
  });
}
