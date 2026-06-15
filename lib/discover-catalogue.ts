import {
  rankFeaturedBooks,
  type FeaturedBookWithTargeting,
} from "@/lib/featured-book-scoring";
import { getScoringWeights } from "@/lib/featured-scoring-config";
import { getUserScoringProfile } from "@/lib/discover-scoring-profile";
import { prisma } from "@/lib/prisma";
import type { BookGenre } from "@db";
import type { Prisma } from "@db";

export const DISCOVER_PAGE_SIZE = 24;
const FEATURED_POOL_SIZE = 20;
const FEATURED_DISPLAY_LIMIT = 5;

export type DiscoverCatalogueBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string;
  genre: BookGenre | null;
  readerCount: number;
  description?: string | null;
};

const featuredBookSelect = {
  id: true,
  title: true,
  author: true,
  description: true,
  coverImageUrl: true,
  genre: true,
  isPublicDomain: true,
  createdAt: true,
  featuredTargetAgeRanges: true,
  featuredTargetGenders: true,
  featuredTargetCountries: true,
  featuredTargetGenres: true,
  _count: { select: { userBooks: true } },
} as const;

function toCatalogueBook(
  book: FeaturedBookWithTargeting & { readerCount: number },
): DiscoverCatalogueBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    genre: book.genre as BookGenre | null,
    coverImageUrl: book.coverImageUrl,
    readerCount: book.readerCount,
  };
}

function rowToFeaturedBook(
  row: Prisma.BookGetPayload<{ select: typeof featuredBookSelect }>,
): FeaturedBookWithTargeting & { readerCount: number } {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    coverImageUrl: row.coverImageUrl!,
    genre: row.genre,
    readerCount: row._count.userBooks,
    isPublicDomain: row.isPublicDomain,
    createdAt: row.createdAt,
    featuredTargetAgeRanges: row.featuredTargetAgeRanges,
    featuredTargetGenders: row.featuredTargetGenders,
    featuredTargetCountries: row.featuredTargetCountries,
    featuredTargetGenres: row.featuredTargetGenres,
  };
}

function catalogueFilters(genre?: BookGenre): Prisma.BookWhereInput {
  return {
    status: "published",
    deletedAt: null,
    coverImageUrl: { not: null },
    ...(genre ? { genre } : {}),
  };
}

function featuredPoolFilters(userId: string | null): Prisma.BookWhereInput {
  if (!userId) return catalogueFilters();

  return {
    ...catalogueFilters(),
    userBooks: {
      none: {
        userId,
        isActive: true,
      },
    },
  };
}

/** Featured carousel — personalised when userId is provided. */
export async function getDiscoverFeaturedBooks(
  userId: string | null = null,
  limit: number = FEATURED_DISPLAY_LIMIT,
): Promise<DiscoverCatalogueBook[]> {
  const rows = await prisma.book.findMany({
    where: featuredPoolFilters(userId),
    orderBy: { userBooks: { _count: "desc" } },
    take: FEATURED_POOL_SIZE,
    select: featuredBookSelect,
  });

  const books = rows.map(rowToFeaturedBook);

  if (!userId) {
    return books.slice(0, limit).map(toCatalogueBook);
  }

  const weights = await getScoringWeights();
  const profile = await getUserScoringProfile(userId, weights.libraryRecencyDays);
  const ranked = rankFeaturedBooks(books, profile, limit, weights);
  return ranked.map((s) => toCatalogueBook(s.book));
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
