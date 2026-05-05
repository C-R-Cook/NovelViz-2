import { mockPartnerBookPayload, USE_PARTNER_ANALYTICS_MOCK } from "@/lib/partner-analytics-mock";
import { prisma } from "@/lib/prisma";

function endOfUtcMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999));
}

export type BookTimePoint = { monthKey: string; label: string; cumulativeReaders: number };
export type ChapterEngagementRow = { chapter: number; label: string; total: number };

export type PartnerBookAnalyticsPayload = {
  book: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
    chapterCount: number;
  };
  readerCount: number;
  queryCount: number;
  imageCount: number;
  engagement: number;
  readersOverTime: BookTimePoint[];
  chapterEngagement: ChapterEngagementRow[];
};

export async function fetchPartnerBookAnalytics(
  bookId: string,
  ownerId: string,
): Promise<PartnerBookAnalyticsPayload | null> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId, deletedAt: null },
    include: { _count: { select: { chapters: true } } },
  });
  if (!book) return null;

  if (USE_PARTNER_ANALYTICS_MOCK) {
    const chapterCount = Math.max(1, book._count.chapters);
    return mockPartnerBookPayload({
      id: book.id,
      title: book.title,
      author: book.author,
      coverImageUrl: book.coverImageUrl,
      chapterCount,
    });
  }

  const [distinctReadersRows, queryCount, imageCount, qGroups, iGroups] = await Promise.all([
    prisma.userBook.findMany({
      where: { bookId, isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.query.count({ where: { bookId } }),
    prisma.generatedImage.count({ where: { bookId } }),
    prisma.query.groupBy({
      by: ["chapterNumberAtTime"],
      where: { bookId },
      _count: { _all: true },
    }),
    prisma.generatedImage.groupBy({
      by: ["chapterNumberAtTime"],
      where: { bookId },
      _count: { _all: true },
    }),
  ]);

  const readerCount = distinctReadersRows.length;
  const engagementSum = queryCount + imageCount;
  const engagement = readerCount > 0 ? Math.round((engagementSum / readerCount) * 10) / 10 : 0;

  const now = new Date();
  const readersOverTime: BookTimePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const end = endOfUtcMonth(y, m);
    const cumulativeReaders = await prisma.userBook.count({
      where: {
        bookId,
        isActive: true,
        addedAt: { lte: end },
      },
    });
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    readersOverTime.push({ monthKey, label, cumulativeReaders });
  }

  const maxCh = Math.max(1, book._count.chapters);
  const byChapter = new Map<number, number>();
  for (let sn = 1; sn <= maxCh; sn++) {
    byChapter.set(sn, 0);
  }
  for (const row of qGroups) {
    const n = row.chapterNumberAtTime;
    if (n >= 1 && n <= maxCh) {
      byChapter.set(n, (byChapter.get(n) ?? 0) + row._count._all);
    }
  }
  for (const row of iGroups) {
    const n = row.chapterNumberAtTime;
    if (n >= 1 && n <= maxCh) {
      byChapter.set(n, (byChapter.get(n) ?? 0) + row._count._all);
    }
  }

  const chapterEngagement: ChapterEngagementRow[] = [];
  for (let sn = 1; sn <= maxCh; sn++) {
    chapterEngagement.push({
      chapter: sn,
      label: `Chapter ${sn}`,
      total: byChapter.get(sn) ?? 0,
    });
  }

  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      coverImageUrl: book.coverImageUrl,
      chapterCount: maxCh,
    },
    readerCount,
    queryCount,
    imageCount,
    engagement,
    readersOverTime,
    chapterEngagement,
  };
}
