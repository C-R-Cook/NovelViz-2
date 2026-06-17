import { CommentStatus } from "@db";
import { mockPartnerBookPayload, USE_PARTNER_ANALYTICS_MOCK } from "@/lib/partner-analytics-mock";
import { prisma } from "@/lib/prisma";

function startOfUtcMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0));
}

function endOfUtcMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999));
}

export type BookTimePoint = { monthKey: string; label: string; cumulativeReaders: number };
export type EngagementTimePoint = {
  monthKey: string;
  label: string;
  questions: number;
  images: number;
};
export type ChapterEngagementRow = {
  chapter: number;
  label: string;
  questions: number;
  images: number;
  total: number;
};
export type ReadingDepthRow = { chapter: number; label: string; readersReached: number };
export type PartnerGalleryStats = {
  publicImages: number;
  featuredImages: number;
  totalLikes: number;
  commentCount: number;
};
export type BookRecentQuestion = {
  id: string;
  questionText: string;
  chapterNumberAtTime: number;
  createdAtMs: number;
  username: string;
};

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
  libraryAddsWithoutProgress: number;
  readersOverTime: BookTimePoint[];
  engagementOverTime: EngagementTimePoint[];
  chapterEngagement: ChapterEngagementRow[];
  readingDepth: ReadingDepthRow[];
  gallery: PartnerGalleryStats;
  recentQuestions: BookRecentQuestion[];
};

async function buildEngagementOverTime(bookId: string): Promise<EngagementTimePoint[]> {
  const now = new Date();
  const out: EngagementTimePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const start = startOfUtcMonth(y, m);
    const end = endOfUtcMonth(y, m);
    const [questions, images] = await Promise.all([
      prisma.query.count({ where: { bookId, createdAt: { gte: start, lte: end } } }),
      prisma.generatedImage.count({ where: { bookId, createdAt: { gte: start, lte: end } } }),
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

async function buildGalleryStats(bookId: string): Promise<PartnerGalleryStats> {
  const [publicImages, featuredImages, likesAgg, commentCount] = await Promise.all([
    prisma.generatedImage.count({ where: { bookId, isPublic: true } }),
    prisma.generatedImage.count({ where: { bookId, isFeatured: true, isPublic: true } }),
    prisma.generatedImage.aggregate({
      where: { bookId, isPublic: true },
      _sum: { likeCount: true },
    }),
    prisma.comment.count({
      where: {
        status: CommentStatus.VISIBLE,
        image: { bookId, isPublic: true },
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

  const maxCh = Math.max(1, book._count.chapters);

  const [
    distinctReadersRows,
    progressRows,
    queryCount,
    imageCount,
    qGroups,
    iGroups,
    engagementOverTime,
    gallery,
    recentQueryRows,
  ] = await Promise.all([
    prisma.userBook.findMany({
      where: { bookId, isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.readingProgress.findMany({
      where: { bookId },
      select: { currentChapterNumber: true },
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
    buildEngagementOverTime(bookId),
    buildGalleryStats(bookId),
    prisma.query.findMany({
      where: { bookId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        questionText: true,
        chapterNumberAtTime: true,
        createdAt: true,
        user: { select: { username: true, name: true } },
      },
    }),
  ]);

  const readerCount = distinctReadersRows.length;
  const readersWithProgress = progressRows.length;
  const libraryAddsWithoutProgress = Math.max(0, readerCount - readersWithProgress);
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

  const questionsByChapter = new Map<number, number>();
  const imagesByChapter = new Map<number, number>();
  for (let sn = 1; sn <= maxCh; sn++) {
    questionsByChapter.set(sn, 0);
    imagesByChapter.set(sn, 0);
  }
  for (const row of qGroups) {
    const n = row.chapterNumberAtTime;
    if (n >= 1 && n <= maxCh) {
      questionsByChapter.set(n, row._count._all);
    }
  }
  for (const row of iGroups) {
    const n = row.chapterNumberAtTime;
    if (n >= 1 && n <= maxCh) {
      imagesByChapter.set(n, row._count._all);
    }
  }

  const chapterEngagement: ChapterEngagementRow[] = [];
  for (let sn = 1; sn <= maxCh; sn++) {
    const questions = questionsByChapter.get(sn) ?? 0;
    const images = imagesByChapter.get(sn) ?? 0;
    chapterEngagement.push({
      chapter: sn,
      label: `Chapter ${sn}`,
      questions,
      images,
      total: questions + images,
    });
  }

  const reachedCounts = new Array<number>(maxCh + 1).fill(0);
  for (const row of progressRows) {
    const ch = row.currentChapterNumber;
    if (ch >= 1 && ch <= maxCh) {
      for (let n = 1; n <= ch; n++) {
        reachedCounts[n] += 1;
      }
    }
  }

  const readingDepth: ReadingDepthRow[] = [];
  for (let sn = 1; sn <= maxCh; sn++) {
    readingDepth.push({
      chapter: sn,
      label: `Chapter ${sn}`,
      readersReached: reachedCounts[sn] ?? 0,
    });
  }

  const recentQuestions: BookRecentQuestion[] = recentQueryRows.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    chapterNumberAtTime: q.chapterNumberAtTime,
    createdAtMs: q.createdAt.getTime(),
    username: q.user.username ?? q.user.name ?? "Reader",
  }));

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
    libraryAddsWithoutProgress,
    readersOverTime,
    engagementOverTime,
    chapterEngagement,
    readingDepth,
    gallery,
    recentQuestions,
  };
}
