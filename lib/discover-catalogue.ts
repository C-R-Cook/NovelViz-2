import { prisma } from "@/lib/prisma";
import type { BookGenre } from "@db";
import type { Prisma } from "@db";

export const DISCOVER_PAGE_SIZE = 24;

export type DiscoverCatalogueBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string;
  genre: BookGenre | null;
  readerCount: number;
};

function catalogueFilters(genre?: BookGenre): Prisma.BookWhereInput {
  return {
    status: "published",
    deletedAt: null,
    coverImageUrl: { not: null },
    ...(genre ? { genre } : {}),
  };
}

/** Top books by library adds — featured carousel (max 5, covers only). */
export async function getDiscoverFeaturedBooks(): Promise<DiscoverCatalogueBook[]> {
  const rows = await prisma.book.findMany({
    where: catalogueFilters(),
    orderBy: { userBooks: { _count: "desc" } },
    take: 5,
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
      genre: true,
      _count: { select: { userBooks: true } },
    },
  });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre,
    coverImageUrl: b.coverImageUrl!,
    readerCount: b._count.userBooks,
  }));
}

/** Cursor = id of last book on the previous page; order is title asc, id asc. */
export async function getDiscoverBooksPage(input: {
  genre?: BookGenre;
  cursor?: string | null;
}): Promise<{ books: DiscoverCatalogueBook[]; nextCursor: string | null }> {
  const filters: Prisma.BookWhereInput[] = [catalogueFilters(input.genre)];

  if (input.cursor) {
    const cursorBook = await prisma.book.findFirst({
      where: { ...catalogueFilters(input.genre), id: input.cursor },
      select: { id: true, title: true },
    });
    if (!cursorBook) {
      return { books: [], nextCursor: null };
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
    take: DISCOVER_PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
      genre: true,
      _count: { select: { userBooks: true } },
    },
  });

  const hasMore = rows.length > DISCOVER_PAGE_SIZE;
  const slice = hasMore ? rows.slice(0, DISCOVER_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? slice[DISCOVER_PAGE_SIZE - 1]!.id : null;

  return {
    books: slice.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      genre: b.genre,
      coverImageUrl: b.coverImageUrl!,
      readerCount: b._count.userBooks,
    })),
    nextCursor,
  };
}
