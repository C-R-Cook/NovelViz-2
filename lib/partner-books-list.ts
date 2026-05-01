import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";

/** Partner dashboard table page size — must match GET `/api/partner/books` cap */
export const PARTNER_BOOKS_PAGE_SIZE = 50;

export type PartnerDashboardBookRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: BookStatus;
  chapterCount: number;
  readerCount: number;
  queryCount: number;
  imageCount: number;
};

const bookScope = (ownerId: string) => ({
  ownerId,
  deletedAt: null,
});

/** Catalogue-wide stats for the partner stat cards (not limited to the current page). */
export async function fetchPartnerDashboardStats(ownerId: string) {
  const where = bookScope(ownerId);
  const [totalBooks, totalReaders, totalQueries, totalImages] = await Promise.all([
    prisma.book.count({ where }),
    prisma.userBook.count({
      where: { isActive: true, book: where },
    }),
    prisma.query.count({ where: { book: where } }),
    prisma.generatedImage.count({ where: { book: where } }),
  ]);
  return { totalBooks, totalReaders, totalQueries, totalImages };
}

export async function queryPartnerBooksPage(params: {
  ownerId: string;
  skip: number;
}): Promise<{ rows: PartnerDashboardBookRow[]; hasMore: boolean }> {
  const take = PARTNER_BOOKS_PAGE_SIZE;
  const safeSkip = Math.max(0, Number.isFinite(params.skip) ? params.skip : 0);

  const raw = await prisma.book.findMany({
    where: bookScope(params.ownerId),
    orderBy: { createdAt: "desc" },
    skip: safeSkip,
    take: take + 1,
    include: {
      _count: {
        select: {
          chapters: true,
          queries: true,
          generatedImages: true,
          userBooks: { where: { isActive: true } },
        },
      },
    },
  });

  const hasMore = raw.length > take;
  const slice = hasMore ? raw.slice(0, take) : raw;

  const rows: PartnerDashboardBookRow[] = slice.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverImageUrl: b.coverImageUrl,
    status: b.status,
    chapterCount: b._count.chapters,
    readerCount: b._count.userBooks,
    queryCount: b._count.queries,
    imageCount: b._count.generatedImages,
  }));

  return { rows, hasMore };
}
