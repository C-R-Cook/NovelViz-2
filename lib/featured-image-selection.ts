import { getUserScoringProfile } from "@/lib/discover-scoring-profile";
import {
  scoreBook,
  type FeaturedBookWithTargeting,
} from "@/lib/featured-book-scoring";
import { getScoringWeights } from "@/lib/featured-scoring-config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@db";

export const FEATURED_IMAGE_POOL_SIZE = 50;
export const FEATURED_IMAGE_LANDING_LIMIT = 6;
export const FEATURED_IMAGE_GALLERY_LIMIT = 20;
export const MAX_FEATURED_IMAGES_PER_BOOK = 2;

const featuredImageBookSelect = {
  id: true,
  title: true,
  author: true,
  genre: true,
  isPublicDomain: true,
  createdAt: true,
  featuredTargetAgeRanges: true,
  featuredTargetGenders: true,
  featuredTargetCountries: true,
  featuredTargetGenres: true,
} as const;

const featuredImageSelect = {
  id: true,
  imageUrl: true,
  userPrompt: true,
  chapterNumberAtTime: true,
  createdAt: true,
  bookId: true,
  book: { select: featuredImageBookSelect },
} satisfies Prisma.GeneratedImageSelect;

type FeaturedImageRow = Prisma.GeneratedImageGetPayload<{ select: typeof featuredImageSelect }>;

export type FeaturedImageCard = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  createdAt: Date;
  isFeatured: true;
};

function rowToBook(row: FeaturedImageRow["book"]): FeaturedBookWithTargeting {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    coverImageUrl: "",
    genre: row.genre,
    readerCount: 0,
    isPublicDomain: row.isPublicDomain,
    createdAt: row.createdAt,
    featuredTargetAgeRanges: row.featuredTargetAgeRanges,
    featuredTargetGenders: row.featuredTargetGenders,
    featuredTargetCountries: row.featuredTargetCountries,
    featuredTargetGenres: row.featuredTargetGenres,
  };
}

function mapRow(row: FeaturedImageRow): FeaturedImageCard {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    userPrompt: row.userPrompt ?? "",
    chapterNumberAtTime: row.chapterNumberAtTime,
    bookId: row.bookId,
    bookTitle: row.book.title,
    bookAuthor: row.book.author,
    createdAt: row.createdAt,
    isFeatured: true,
  };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function selectGuestImages(rows: FeaturedImageRow[], limit: number): FeaturedImageCard[] {
  return shuffleInPlace([...rows])
    .slice(0, limit)
    .map(mapRow);
}

function selectPersonalisedImages(
  rows: FeaturedImageRow[],
  userId: string,
  limit: number,
): Promise<FeaturedImageCard[]> {
  return (async () => {
    const weights = await getScoringWeights();
    const profile = await getUserScoringProfile(userId, weights.libraryRecencyDays);

    const scored = rows
      .map((row) => ({
        row,
        score: scoreBook(profile, rowToBook(row.book), weights),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.row.createdAt.getTime() - a.row.createdAt.getTime();
      });

    const picked: FeaturedImageRow[] = [];
    const perBook = new Map<string, number>();

    for (const { row } of scored) {
      if (picked.length >= limit) break;
      const count = perBook.get(row.bookId) ?? 0;
      if (count >= MAX_FEATURED_IMAGES_PER_BOOK) continue;
      picked.push(row);
      perBook.set(row.bookId, count + 1);
    }

    return picked.map(mapRow);
  })();
}

async function fetchFeaturedImagePool(poolSize: number): Promise<FeaturedImageRow[]> {
  return prisma.generatedImage.findMany({
    where: {
      isFeatured: true,
      isPublic: true,
      book: { status: "published", deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: poolSize,
    select: featuredImageSelect,
  });
}

/** Reader-facing featured images — random for guests, book-scoring for logged-in users. */
export async function getFeaturedImagesForDisplay(
  userId: string | null,
  opts: { limit: number; poolSize?: number },
): Promise<FeaturedImageCard[]> {
  const poolSize = opts.poolSize ?? FEATURED_IMAGE_POOL_SIZE;
  const rows = await fetchFeaturedImagePool(poolSize);
  if (rows.length === 0) return [];

  if (!userId) {
    return selectGuestImages(rows, opts.limit);
  }

  return selectPersonalisedImages(rows, userId, opts.limit);
}

/** Gallery needs full GeneratedImage fields — fetch by ids after selection. */
export async function getFeaturedImageIdsForDisplay(
  userId: string | null,
  limit: number,
): Promise<string[]> {
  const cards = await getFeaturedImagesForDisplay(userId, { limit });
  return cards.map((c) => c.id);
}
