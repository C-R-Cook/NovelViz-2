import { DashboardClient } from "./dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import { fetchPartnerAnalytics } from "@/lib/partner-analytics";
import {
  PARTNER_BOOKS_PAGE_SIZE,
  fetchPartnerDashboardStats,
  queryPartnerBooksPage,
} from "@/lib/partner-books-list";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | NovelViz",
};

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

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
    pendingBooks: { id: string; title: string; author: string; coverImageUrl: string | null }[];
    totalUsers: number;
    totalBooks: number;
    pendingReviewCount: number;
    bookRequests: { totalCount: number; topBooks: { bookTitle: string; count: number }[] };
  } | null = null;

  if (role === UserRole.admin) {
    const [pendingBooks, totalUsers, totalBooks, pendingReviewCount, bookRequestTitleRows] = await Promise.all([
      prisma.book.findMany({
        where: { status: "pending_review", deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, title: true, author: true, coverImageUrl: true },
      }),
      prisma.user.count(),
      prisma.book.count({ where: { deletedAt: null } }),
      prisma.book.count({ where: { status: "pending_review", deletedAt: null } }),
      prisma.bookRequest.findMany({ select: { bookTitle: true } }),
    ]);
    const titleCount = new Map<string, number>();
    for (const row of bookRequestTitleRows) {
      titleCount.set(row.bookTitle, (titleCount.get(row.bookTitle) ?? 0) + 1);
    }
    const topBooks = [...titleCount.entries()]
      .map(([bookTitle, count]) => ({ bookTitle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    adminPayload = {
      pendingBooks,
      totalUsers,
      totalBooks,
      pendingReviewCount,
      bookRequests: { totalCount: bookRequestTitleRows.length, topBooks },
    };
  }

  return (
    <DashboardClient
      role={role}
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
    />
  );
}
