import { DashboardClient } from "./dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import {
  countPendingFlaggedComments,
  queryAdminFlaggedCommentsQueue,
} from "@/lib/admin-flagged-comments-queue";
import {
  countPendingSpoilerComments,
  queryAdminSpoilerCommentsQueue,
} from "@/lib/admin-spoiler-comments-queue";
import {
  DASHBOARD_ADMIN_BOOKS_LIMIT,
  queryAdminBooksPage,
} from "@/lib/admin-books-list";
import { getAdminStatsPayload, normalizeVendorWindowDays } from "@/lib/admin-stats";
import { type DashboardUserRole } from "@/lib/dashboard-tab";
import { formatGenre } from "@/lib/genre";
import { fetchPartnerAnalytics } from "@/lib/partner-analytics";
import {
  PARTNER_BOOKS_PAGE_SIZE,
  fetchPartnerDashboardStats,
  queryPartnerBooksPage,
} from "@/lib/partner-books-list";
import { prisma } from "@/lib/prisma";
import { getUserUsageSummary } from "@/lib/subscription";
import { FeatureRequestStatus, UserRole } from "@db";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Dashboard | NovelViz",
};

function DashboardLoadingFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-text-muted sm:px-6">
      Loading dashboard…
    </div>
  );
}

type DashboardPageProps = {
  searchParams?: Promise<{ tab?: string | string[]; vendorDays?: string | string[] }>;
};

function toDashboardUserRole(r: UserRole): DashboardUserRole {
  if (r === UserRole.reader) return "reader";
  if (r === UserRole.partner) return "partner";
  return "admin";
}

function roleDisplayLabel(r: UserRole): string {
  if (r === UserRole.reader) return "Reader";
  if (r === UserRole.partner) return "Publisher";
  return "Administrator";
}

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const sp = searchParams ? await searchParams : {};
  const rawVendorDaysSingle =
    typeof sp?.vendorDays === "string"
      ? sp.vendorDays
      : Array.isArray(sp?.vendorDays)
        ? sp.vendorDays[0]
        : undefined;
  const vendorWindowDays = normalizeVendorWindowDays(rawVendorDaysSingle);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      country: true,
      ageRange: true,
      gender: true,
      genrePreferences: true,
      subscribedToMailingList: true,
      globalSpoilerProtection: true,
      createdAt: true,
    },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const userId = dbUser.id;
  const role = dbUser.role;
  const dashboardRole = toDashboardUserRole(role);

  const memberSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(dbUser.createdAt);

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

  let partnerPayload: {
    stats: { totalBooks: number; totalReaders: number; totalQueries: number; totalImages: number };
    analytics: Awaited<ReturnType<typeof fetchPartnerAnalytics>>;
    initialBooks: Awaited<ReturnType<typeof queryPartnerBooksPage>>["rows"];
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
  } | null = null;

  if (role === UserRole.partner || role === UserRole.admin) {
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
    partnerPayload = {
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

  let adminPayload: {
    pendingBooks: {
      id: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      listingPreferenceAfterReview: "published" | "unlisted" | null;
    }[];
    totalUsers: number;
    totalBooks: number;
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
    spoilerCommentsQueue: import("@/lib/admin-spoiler-comments-queue").AdminSpoilerCommentRow[];
    spoilerCommentsPendingCount: number;
    flaggedCommentsQueue: import("@/lib/admin-flagged-comments-queue").AdminFlaggedCommentRow[];
    flaggedCommentsPendingCount: number;
    recentUsers: {
      id: string;
      username: string | null;
      email: string;
      role: UserRole;
      createdAtMs: number;
    }[];
  } | null = null;

  let adminBooksAll: {
    initialBooks: Awaited<ReturnType<typeof queryAdminBooksPage>>["rows"];
    initialHasMore: boolean;
    pageSize: number;
  } | null = null;

  let adminStats: Awaited<ReturnType<typeof getAdminStatsPayload>> | null = null;

  if (role === UserRole.admin) {
    const [
      pendingBooks,
      totalUsers,
      totalBooks,
      pendingReviewCount,
      bookRequestTitleRows,
      allBooksFirstPage,
      statsPayload,
      featureRequestsPendingRows,
      featureRequestsPendingCount,
      spoilerCommentsPendingCount,
      spoilerCommentsQueue,
      flaggedCommentsPendingCount,
      flaggedCommentsQueue,
      recentUsersRows,
    ] = await Promise.all([
      prisma.book.findMany({
        where: { status: "pending_review", deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 50,
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
      prisma.book.count({ where: { status: "pending_review", deletedAt: null } }),
      prisma.bookRequest.findMany({ select: { bookTitle: true } }),
      queryAdminBooksPage({
        filter: "all",
        skip: 0,
        take: DASHBOARD_ADMIN_BOOKS_LIMIT,
        sort: "createdAt",
        dir: "desc",
      }),
      getAdminStatsPayload(vendorWindowDays),
      prisma.featureRequest.findMany({
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
      }),
      prisma.featureRequest.count({ where: { status: FeatureRequestStatus.PENDING } }),
      countPendingSpoilerComments(),
      queryAdminSpoilerCommentsQueue(80),
      countPendingFlaggedComments(),
      queryAdminFlaggedCommentsQueue(80),
      prisma.user.findMany({
        take: 80,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    const titleCount = new Map<string, number>();
    for (const row of bookRequestTitleRows) {
      titleCount.set(row.bookTitle, (titleCount.get(row.bookTitle) ?? 0) + 1);
    }
    const topBooks = [...titleCount.entries()]
      .map(([bookTitle, count]) => ({ bookTitle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const featureRequestsQueue = featureRequestsPendingRows.map((fr) => ({
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

    adminPayload = {
      pendingBooks,
      totalUsers,
      totalBooks,
      pendingReviewCount,
      bookRequests: { totalCount: bookRequestTitleRows.length, topBooks },
      featureRequestsQueue,
      featureRequestsPendingCount,
      spoilerCommentsQueue,
      spoilerCommentsPendingCount,
      flaggedCommentsQueue,
      flaggedCommentsPendingCount,
      recentUsers: recentUsersRows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAtMs: u.createdAt.getTime(),
      })),
    };
    adminBooksAll = {
      initialBooks: allBooksFirstPage.rows,
      initialHasMore: allBooksFirstPage.hasMore,
      pageSize: DASHBOARD_ADMIN_BOOKS_LIMIT,
    };
    adminStats = statsPayload;
  }

  return (
    <DashboardClient
      role={dashboardRole}
      roleDisplayLabel={roleDisplayLabel(role)}
      reader={{
        displayName:
          dbUser.username?.trim() ||
          dbUser.name?.trim() ||
          dbUser.email.split("@")[0] ||
          "Reader",
        username: dbUser.username,
        email: dbUser.email,
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
      }}
      partner={partnerPayload}
      admin={adminPayload}
      adminBooksAll={adminBooksAll}
      adminStats={adminStats}
      account={{
        viewerId: session.id,
        user: {
          name: dbUser.name,
          username: dbUser.username,
          email: dbUser.email,
          country: dbUser.country,
          ageRange: dbUser.ageRange,
          gender: dbUser.gender,
          genrePreferences: dbUser.genrePreferences,
          subscribedToMailingList: dbUser.subscribedToMailingList,
          globalSpoilerProtection: dbUser.globalSpoilerProtection,
        },
        stats: { libraryBookCount, queryCount, generatedImageCount },
        memberSinceLabel,
        isProduction: process.env.NODE_ENV === "production",
        usageSummary: await getUserUsageSummary(session.id),
      }}
    />
  );
}

export default function DashboardPage(props: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
