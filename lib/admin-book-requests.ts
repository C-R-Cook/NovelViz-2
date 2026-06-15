import { prisma } from "@/lib/prisma";

export type BookRequestAggregateRow = {
  bookTitle: string;
  authorName: string;
  requestCount: number;
  firstRequested: Date;
};

export type BookRequestSubmissionRow = {
  id: string;
  bookTitle: string;
  authorName: string;
  message: string | null;
  createdAt: Date;
  requesterLabel: string;
  requesterEmail: string | null;
};

const SUBMISSIONS_DEFAULT_LIMIT = 200;

export async function queryBookRequestAggregates(): Promise<BookRequestAggregateRow[]> {
  const requests = await prisma.bookRequest.findMany({
    orderBy: { createdAt: "asc" },
    select: { bookTitle: true, authorName: true, createdAt: true },
  });

  const byTitle = new Map<string, BookRequestAggregateRow>();
  for (const r of requests) {
    const title = r.bookTitle.trim();
    const existing = byTitle.get(title);
    if (!existing) {
      byTitle.set(title, {
        bookTitle: r.bookTitle,
        authorName: r.authorName,
        requestCount: 1,
        firstRequested: r.createdAt,
      });
    } else {
      existing.requestCount += 1;
      if (r.createdAt < existing.firstRequested) {
        existing.firstRequested = r.createdAt;
      }
    }
  }

  return [...byTitle.values()].sort((a, b) => b.requestCount - a.requestCount);
}

export async function queryTopBookRequestsByTitle(limit = 5): Promise<{ bookTitle: string; count: number }[]> {
  const grouped = await prisma.bookRequest.groupBy({
    by: ["bookTitle"],
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ bookTitle: g.bookTitle, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function queryBookRequestSubmissions(
  limit = SUBMISSIONS_DEFAULT_LIMIT,
): Promise<BookRequestSubmissionRow[]> {
  const rows = await prisma.bookRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      bookTitle: true,
      authorName: true,
      message: true,
      createdAt: true,
      user: { select: { name: true, email: true, username: true } },
    },
  });

  return rows.map((r) => {
    const requesterLabel = r.user
      ? r.user.name?.trim() || r.user.username?.trim() || r.user.email
      : "Guest";
    return {
      id: r.id,
      bookTitle: r.bookTitle,
      authorName: r.authorName,
      message: r.message,
      createdAt: r.createdAt,
      requesterLabel,
      requesterEmail: r.user?.email ?? null,
    };
  });
}
