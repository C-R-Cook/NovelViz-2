import { DashboardClient } from "./dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import {
  DASHBOARD_ADMIN_BOOKS_LIMIT,
  queryAdminBooksPage,
} from "@/lib/admin-books-list";
import { getAdminStatsPayload, normalizeVendorWindowDays } from "@/lib/admin-stats";
import { parseDashboardTab, type DashboardUserRole } from "@/lib/dashboard-tab";
import { fetchPartnerAnalytics } from "@/lib/partner-analytics";
import {
  PARTNER_BOOKS_PAGE_SIZE,
  fetchPartnerDashboardStats,
  queryPartnerBooksPage,
} from "@/lib/partner-books-list";
import { prisma } from "@/lib/prisma";
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

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const sp = searchParams ? await searchParams : {};
  const rawTabSingle = typeof sp?.tab === "string" ? sp.tab : Array.isArray(sp?.tab) ? sp.tab[0] : undefined;
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
    },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const userId = dbUser.id;
  const role = dbUser.role;
  const dashboardRole = toDashboardUserRole(role);
  const initialTab = parseDashboardTab(dashboardRole, rawTabSingle);

  const [
    libraryBookCount,
    queryCount,
    generatedImageCount,
    readingProgress,
    recentQueries,
    recentImages,
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
        book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
        currentChapter: { select: { title: true, sequenceNumber: true } },
      },
    }),
    prisma.query.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { book: { select: { title: true } } },
    }),
    prisma.generatedImage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { book: { select: { title: true } } },
    }),
  ]);

  let partnerPayload: {
    stats: { totalBooks: number; totalReaders: number; totalQueries: number; totalImages: number };
    analytics: Awaited<ReturnType<typeof fetchPartnerAnalytics>>;
    initialBooks: Awaited<ReturnType<typeof queryPartnerBooksPage>>["rows"];
    initialHasMore: boolean;
    pageSize: number;
  } | null = null;

  if (role === UserRole.partner || role === UserRole.admin) {
    const [stats, analytics, page0] = await Promise.all([
      fetchPartnerDashboardStats(userId),
      fetchPartnerAnalytics(userId),
      queryPartnerBooksPage({ ownerId: userId, skip: 0 }),
    ]);
    partnerPayload = {
      stats,
      analytics,
      initialBooks: page0.rows,
      initialHasMore: page0.hasMore,
      pageSize: PARTNER_BOOKS_PAGE_SIZE,
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
      initialTab={initialTab}
      reader={{
        displayName:
          dbUser.username?.trim() ||
          dbUser.name?.trim() ||
          dbUser.email.split("@")[0] ||
          "Reader",
        email: dbUser.email,
        stats: { libraryBookCount, queryCount, generatedImageCount },
        currentlyReading: readingProgress.map((rp) => ({
          bookId: rp.book.id,
          title: rp.book.title,
          author: rp.book.author,
          coverImageUrl: rp.book.coverImageUrl,
          currentChapterNumber: rp.currentChapterNumber,
          chapterTitle: rp.currentChapter.title,
        })),
        recentQueries: recentQueries.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          bookTitle: q.book.title,
          createdAtMs: q.createdAt.getTime(),
        })),
        recentImages: recentImages.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          bookTitle: img.book.title,
          createdAtMs: img.createdAt.getTime(),
        })),
      }}
      partner={partnerPayload}
      admin={adminPayload}
      adminBooksAll={adminBooksAll}
      adminStats={adminStats}
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
