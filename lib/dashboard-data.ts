import {
  countPendingFlaggedComments,
  queryAdminFlaggedCommentsQueue,
  type AdminFlaggedCommentRow,
} from "@/lib/admin-flagged-comments-queue";
import {
  countPendingSpoilerComments,
  queryAdminSpoilerCommentsQueue,
  type AdminSpoilerCommentRow,
} from "@/lib/admin-spoiler-comments-queue";
import {
  DASHBOARD_ADMIN_BOOKS_LIMIT,
  FOR_REVIEW_QUEUE_PAGE_SIZE,
  queryAdminBooksPage,
  type AdminBookRow,
} from "@/lib/admin-books-list";
import { getAdminStatsPayload, type AdminStatsPayload } from "@/lib/admin-stats";
import type { DashboardTabSlug } from "@/lib/dashboard-tab";
import { formatGenre } from "@/lib/genre";
import { fetchPartnerAnalytics, type PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import {
  PARTNER_BOOKS_PAGE_SIZE,
  fetchPartnerDashboardStats,
  queryPartnerBooksPage,
  type PartnerDashboardBookRow,
} from "@/lib/partner-books-list";
import { prisma } from "@/lib/prisma";
import { FeatureRequestStatus } from "@db";

export type DashboardReaderData = {
  stats: { libraryBookCount: number; queryCount: number; generatedImageCount: number };
  currentlyReading: {
    bookId: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
    currentChapterNumber: number;
    chapterTitle: string | null;
    genreLabel: string;
    chapterCount: number;
    queryCount: number;
    imageCount: number;
    progressPercent: number;
  }[];
  recentQueries: {
    id: string;
    questionText: string;
    bookTitle: string;
    chapterNumberAtTime: number;
    createdAtMs: number;
  }[];
  recentImages: {
    id: string;
    imageUrl: string;
    bookTitle: string;
    chapterNumberAtTime: number;
    userPrompt: string;
    isPublic: boolean;
    createdAtMs: number;
  }[];
};

export type DashboardPartnerData = {
  stats: { totalBooks: number; totalReaders: number; totalQueries: number; totalImages: number };
  analytics: PartnerAnalyticsPayload;
  initialBooks: PartnerDashboardBookRow[];
  initialHasMore: boolean;
  pageSize: number;
  ownFeatureRequests: {
    id: string;
    status: FeatureRequestStatus;
    createdAtMs: number;
    bookTitle: string;
    chapterNumberAtTime: number;
    userPrompt: string;
    imageUrl: string;
  }[];
  ownFeatureRequestsPendingCount: number;
};

export type DashboardAdminData = {
  pendingBooks: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
    listingPreferenceAfterReview: "published" | "unlisted" | null;
  }[];
  totalUsers: number;
  totalBooks: number;
  /** Published, non-deleted — visible on Discover (/books). */
  liveBooksCount: number;
  pendingReviewCount: number;
  bookRequests: { totalCount: number; topBooks: { bookTitle: string; count: number }[] };
  featureRequestsQueue: {
    requestId: string;
    imageId: string;
    createdAtMs: number;
    imageUrl: string;
    userPrompt: string;
    chapterNumberAtTime: number;
    bookId: string;
    bookTitle: string;
    bookAuthor: string;
    bookCoverImageUrl: string | null;
    username: string;
  }[];
  featureRequestsPendingCount: number;
  spoilerCommentsQueue: AdminSpoilerCommentRow[];
  spoilerCommentsPendingCount: number;
  flaggedCommentsQueue: AdminFlaggedCommentRow[];
  flaggedCommentsPendingCount: number;
};

export type DashboardAdminBooksAll = {
  initialBooks: AdminBookRow[];
  initialHasMore: boolean;
  pageSize: number;
};

async function loadTopBookRequests(): Promise<{ bookTitle: string; count: number }[]> {
  const grouped = await prisma.bookRequest.groupBy({
    by: ["bookTitle"],
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ bookTitle: g.bookTitle, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function mapFeatureRequestRows(
  rows: Awaited<
    ReturnType<
      typeof prisma.featureRequest.findMany<{
        include: {
          image: {
            select: {
              id: true;
              imageUrl: true;
              userPrompt: true;
              chapterNumberAtTime: true;
              book: { select: { id: true; title: true; author: true; coverImageUrl: true } };
              user: { select: { username: true; name: true } };
            };
          };
        };
      }>
    >
  >,
) {
  return rows.map((fr) => ({
    requestId: fr.id,
    imageId: fr.imageId,
    createdAtMs: fr.createdAt.getTime(),
    imageUrl: fr.image.imageUrl,
    userPrompt: fr.image.userPrompt ?? "",
    chapterNumberAtTime: fr.image.chapterNumberAtTime,
    bookId: fr.image.book.id,
    bookTitle: fr.image.book.title,
    bookAuthor: fr.image.book.author,
    bookCoverImageUrl: fr.image.book.coverImageUrl,
    username: fr.image.user.username ?? fr.image.user.name ?? "",
  }));
}

export async function loadReaderDashboardData(userId: string): Promise<DashboardReaderData> {
  const [
    libraryBookCount,
    queryCount,
    generatedImageCount,
    readingProgress,
    recentQueries,
    recentImages,
    queryByBook,
    imageByBook,
  ] = await Promise.all([
    prisma.userBook.count({ where: { userId, isActive: true } }),
    prisma.query.count({ where: { userId } }),
    prisma.generatedImage.count({ where: { userId } }),
    prisma.readingProgress.findMany({
      where: {
        userId,
        book: { deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverImageUrl: true,
            genre: true,
            _count: { select: { chapters: true } },
          },
        },
        currentChapter: { select: { title: true, sequenceNumber: true } },
      },
    }),
    prisma.query.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        questionText: true,
        chapterNumberAtTime: true,
        createdAt: true,
        book: { select: { title: true } },
      },
    }),
    prisma.generatedImage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        imageUrl: true,
        userPrompt: true,
        chapterNumberAtTime: true,
        isPublic: true,
        createdAt: true,
        book: { select: { title: true } },
      },
    }),
    prisma.query.groupBy({
      by: ["bookId"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.generatedImage.groupBy({
      by: ["bookId"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const qCountMap = new Map(queryByBook.map((r) => [r.bookId, r._count._all]));
  const imgCountMap = new Map(imageByBook.map((r) => [r.bookId, r._count._all]));

  return {
    stats: { libraryBookCount, queryCount, generatedImageCount },
    currentlyReading: readingProgress.map((rp) => {
      const chCount = Math.max(1, rp.book._count.chapters);
      const pct = Math.round((rp.currentChapterNumber / chCount) * 100);
      return {
        bookId: rp.book.id,
        title: rp.book.title,
        author: rp.book.author,
        coverImageUrl: rp.book.coverImageUrl,
        currentChapterNumber: rp.currentChapterNumber,
        chapterTitle: rp.currentChapter.title,
        genreLabel: formatGenre(rp.book.genre),
        chapterCount: rp.book._count.chapters,
        queryCount: qCountMap.get(rp.book.id) ?? 0,
        imageCount: imgCountMap.get(rp.book.id) ?? 0,
        progressPercent: Math.min(100, pct),
      };
    }),
    recentQueries: recentQueries.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      bookTitle: q.book.title,
      chapterNumberAtTime: q.chapterNumberAtTime,
      createdAtMs: q.createdAt.getTime(),
    })),
    recentImages: recentImages.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      bookTitle: img.book.title,
      chapterNumberAtTime: img.chapterNumberAtTime,
      userPrompt: img.userPrompt,
      isPublic: img.isPublic,
      createdAtMs: img.createdAt.getTime(),
    })),
  };
}

export async function loadPartnerDashboardData(userId: string): Promise<DashboardPartnerData> {
  const [stats, analytics, page0, ownFrRows, ownFrPending] = await Promise.all([
    fetchPartnerDashboardStats(userId),
    fetchPartnerAnalytics(userId),
    queryPartnerBooksPage({ ownerId: userId, skip: 0 }),
    prisma.featureRequest.findMany({
      where: { requestedBy: userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        image: {
          select: {
            imageUrl: true,
            userPrompt: true,
            chapterNumberAtTime: true,
            book: { select: { title: true } },
          },
        },
      },
    }),
    prisma.featureRequest.count({
      where: { requestedBy: userId, status: FeatureRequestStatus.PENDING },
    }),
  ]);

  return {
    stats,
    analytics,
    initialBooks: page0.rows,
    initialHasMore: page0.hasMore,
    pageSize: PARTNER_BOOKS_PAGE_SIZE,
    ownFeatureRequests: ownFrRows.map((fr) => ({
      id: fr.id,
      status: fr.status,
      createdAtMs: fr.createdAt.getTime(),
      bookTitle: fr.image.book.title,
      chapterNumberAtTime: fr.image.chapterNumberAtTime,
      userPrompt: fr.image.userPrompt ?? "",
      imageUrl: fr.image.imageUrl,
    })),
    ownFeatureRequestsPendingCount: ownFrPending,
  };
}

export async function loadAdminDashboardData(
  activeTab: DashboardTabSlug,
  vendorWindowDays: number,
): Promise<{
  admin: DashboardAdminData;
  adminBooksAll: DashboardAdminBooksAll | null;
  adminStats: AdminStatsPayload | null;
}> {
  const [
    pendingBooks,
    totalUsers,
    totalBooks,
    liveBooksCount,
    pendingReviewCount,
    bookRequestTotalCount,
    featureRequestsPendingCount,
    spoilerCommentsPendingCount,
    flaggedCommentsPendingCount,
  ] = await Promise.all([
    prisma.book.findMany({
      where: { status: "pending_review", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: FOR_REVIEW_QUEUE_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        author: true,
        coverImageUrl: true,
        listingPreferenceAfterReview: true,
      },
    }),
    prisma.user.count(),
    prisma.book.count({ where: { deletedAt: null } }),
    prisma.book.count({ where: { status: "published", deletedAt: null } }),
    prisma.book.count({ where: { status: "pending_review", deletedAt: null } }),
    prisma.bookRequest.count(),
    prisma.featureRequest.count({ where: { status: FeatureRequestStatus.PENDING } }),
    countPendingSpoilerComments(),
    countPendingFlaggedComments(),
  ]);

  const tabLoads = await Promise.all([
    activeTab === "admin-stats"
      ? Promise.all([getAdminStatsPayload(vendorWindowDays), loadTopBookRequests()])
      : Promise.resolve(null),
    activeTab === "feature-approvals"
      ? prisma.featureRequest.findMany({
          where: { status: FeatureRequestStatus.PENDING },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            image: {
              select: {
                id: true,
                imageUrl: true,
                userPrompt: true,
                chapterNumberAtTime: true,
                book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
                user: { select: { username: true, name: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
    activeTab === "spoiler-comments" ? queryAdminSpoilerCommentsQueue(80) : Promise.resolve(null),
    activeTab === "flagged-comments" ? queryAdminFlaggedCommentsQueue(80) : Promise.resolve(null),
    activeTab === "all-books"
      ? queryAdminBooksPage({
          filter: "all",
          skip: 0,
          take: DASHBOARD_ADMIN_BOOKS_LIMIT,
          sort: "createdAt",
          dir: "desc",
        })
      : Promise.resolve(null),
  ]);

  const statsBundle = tabLoads[0];
  const featureRows = tabLoads[1];
  const spoilerQueue = tabLoads[2];
  const flaggedQueue = tabLoads[3];
  const allBooksPage = tabLoads[4];

  const topBooks =
    statsBundle && Array.isArray(statsBundle) ? statsBundle[1] : [];

  return {
    admin: {
      pendingBooks,
      totalUsers,
      totalBooks,
      liveBooksCount,
      pendingReviewCount,
      bookRequests: {
        totalCount: bookRequestTotalCount,
        topBooks,
      },
      featureRequestsQueue: featureRows ? mapFeatureRequestRows(featureRows) : [],
      featureRequestsPendingCount,
      spoilerCommentsQueue: spoilerQueue ?? [],
      spoilerCommentsPendingCount,
      flaggedCommentsQueue: flaggedQueue ?? [],
      flaggedCommentsPendingCount,
    },
    adminBooksAll: allBooksPage
      ? {
          initialBooks: allBooksPage.rows,
          initialHasMore: allBooksPage.hasMore,
          pageSize: DASHBOARD_ADMIN_BOOKS_LIMIT,
        }
      : null,
    adminStats: statsBundle && Array.isArray(statsBundle) ? statsBundle[0] : null,
  };
}
