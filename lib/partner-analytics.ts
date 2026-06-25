import { CommentStatus } from "@db";
import { ANALYTICS_AGE_LABELS, ANALYTICS_AGE_ORDER, analyticsAgeBucketKey } from "@/lib/age-range";
import { formatGenre } from "@/lib/genre";
import type { EngagementTimePoint, PartnerGalleryStats } from "@/lib/partner-book-analytics";
import { mockPartnerAnalyticsPayload, USE_PARTNER_ANALYTICS_MOCK } from "@/lib/partner-analytics-mock";
import { prisma } from "@/lib/prisma";

const bookScope = (ownerId: string) => ({ ownerId, deletedAt: null });

function startOfUtcMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0));
}

function endOfUtcMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999));
}


export type PartnerTimePoint = { monthKey: string; label: string; cumulativeReaders: number };
export type PartnerBarRow = { label: string; count: number };
export type PartnerTopBookRow = {
  bookId: string;
  title: string;
  readerCount: number;
  engagement: number;
};

export type PartnerAnalyticsPayload = {
  distinctReaderCount: number;
  totalQueries: number;
  totalImages: number;
  avgEngagement: number;
  readersOverTime: PartnerTimePoint[];
  engagementOverTime: EngagementTimePoint[];
  gallery: PartnerGalleryStats;
  topBooks: PartnerTopBookRow[];
  ageBuckets: PartnerBarRow[];
  genreBuckets: PartnerBarRow[];
};

async function buildPortfolioEngagementOverTime(whereBook: {
  ownerId: string;
  deletedAt: null;
}): Promise<EngagementTimePoint[]> {
  const now = new Date();
  const out: EngagementTimePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const start = startOfUtcMonth(y, m);
    const end = endOfUtcMonth(y, m);
    const [questions, images] = await Promise.all([
      prisma.query.count({ where: { book: whereBook, createdAt: { gte: start, lte: end } } }),
      prisma.generatedImage.count({ where: { book: whereBook, createdAt: { gte: start, lte: end } } }),
    ]);
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    out.push({ monthKey, label, questions, images });
  }
  return out;
}

async function buildPortfolioGallery(whereBook: {
  ownerId: string;
  deletedAt: null;
}): Promise<PartnerGalleryStats> {
  const [publicImages, featuredImages, likesAgg, commentCount] = await Promise.all([
    prisma.generatedImage.count({ where: { book: whereBook, isPublic: true } }),
    prisma.generatedImage.count({ where: { book: whereBook, isFeatured: true, isPublic: true } }),
    prisma.generatedImage.aggregate({
      where: { book: whereBook, isPublic: true },
      _sum: { likeCount: true },
    }),
    prisma.comment.count({
      where: {
        status: CommentStatus.VISIBLE,
        image: { book: whereBook, isPublic: true },
      },
    }),
  ]);
  return {
    publicImages,
    featuredImages,
    totalLikes: likesAgg._sum.likeCount ?? 0,
    commentCount,
  };
}

async function buildTopBooks(whereBook: { ownerId: string; deletedAt: null }): Promise<PartnerTopBookRow[]> {
  const [books, qGroups, iGroups, readerGroups] = await Promise.all([
    prisma.book.findMany({
      where: whereBook,
      select: { id: true, title: true },
    }),
    prisma.query.groupBy({
      by: ["bookId"],
      where: { book: whereBook },
      _count: { _all: true },
    }),
    prisma.generatedImage.groupBy({
      by: ["bookId"],
      where: { book: whereBook },
      _count: { _all: true },
    }),
    prisma.userBook.groupBy({
      by: ["bookId"],
      where: { isActive: true, book: whereBook },
      _count: { _all: true },
    }),
  ]);

  const qMap = new Map(qGroups.map((r) => [r.bookId, r._count._all]));
  const iMap = new Map(iGroups.map((r) => [r.bookId, r._count._all]));
  const rMap = new Map(readerGroups.map((r) => [r.bookId, r._count._all]));

  const rows: PartnerTopBookRow[] = books.map((b) => {
    const engagement = (qMap.get(b.id) ?? 0) + (iMap.get(b.id) ?? 0);
    return {
      bookId: b.id,
      title: b.title,
      readerCount: rMap.get(b.id) ?? 0,
      engagement,
    };
  });

  return rows.sort((a, b) => b.engagement - a.engagement).slice(0, 5);
}

export async function fetchPartnerAnalytics(ownerId: string): Promise<PartnerAnalyticsPayload> {
  if (USE_PARTNER_ANALYTICS_MOCK) return mockPartnerAnalyticsPayload();

  const whereBook = bookScope(ownerId);

  const [
    distinctReadersRows,
    totalQueries,
    totalImages,
    engagementOverTime,
    gallery,
    topBooks,
  ] = await Promise.all([
    prisma.userBook.findMany({
      where: { isActive: true, book: whereBook },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.query.count({ where: { book: whereBook } }),
    prisma.generatedImage.count({ where: { book: whereBook } }),
    buildPortfolioEngagementOverTime(whereBook),
    buildPortfolioGallery(whereBook),
    buildTopBooks(whereBook),
  ]);

  const distinctReaderCount = distinctReadersRows.length;
  const engagementSum = totalQueries + totalImages;
  const avgEngagement =
    distinctReaderCount > 0 ? Math.round((engagementSum / distinctReaderCount) * 10) / 10 : 0;

  const now = new Date();
  const readersOverTime: PartnerTimePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const end = endOfUtcMonth(y, m);
    const cumulativeReaders = await prisma.userBook.count({
      where: {
        isActive: true,
        addedAt: { lte: end },
        book: whereBook,
      },
    });
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    readersOverTime.push({ monthKey, label, cumulativeReaders });
  }

  const readerIds = distinctReadersRows.map((r) => r.userId);
  const users =
    readerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: readerIds } },
          select: { ageRange: true, genrePreferences: true },
        })
      : [];

  const ageCounts = new Map<string, number>();
  for (const k of ANALYTICS_AGE_ORDER) ageCounts.set(k, 0);
  ageCounts.set("UNKNOWN", 0);
  for (const u of users) {
    const key = analyticsAgeBucketKey(u.ageRange);
    ageCounts.set(key, (ageCounts.get(key) ?? 0) + 1);
  }

  const ageBuckets: PartnerBarRow[] = [...ANALYTICS_AGE_ORDER, "UNKNOWN"].map((key) => ({
    label: ANALYTICS_AGE_LABELS[key] ?? key,
    count: ageCounts.get(key) ?? 0,
  }));

  const genreCounts = new Map<string, number>();
  for (const u of users) {
    for (const g of u.genrePreferences) {
      if (!g) continue;
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const genreBuckets: PartnerBarRow[] = [...genreCounts.entries()]
    .map(([genre, count]) => ({ label: formatGenre(genre), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  return {
    distinctReaderCount,
    totalQueries,
    totalImages,
    avgEngagement,
    readersOverTime,
    engagementOverTime,
    gallery,
    topBooks,
    ageBuckets,
    genreBuckets,
  };
}
