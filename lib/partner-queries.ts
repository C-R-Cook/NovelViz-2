import { prisma } from "@/lib/prisma";

export const PARTNER_QUERIES_PAGE_SIZE = 40;
export const PARTNER_QUERIES_TAKE_MAX = 100;

export type PartnerQueryRow = {
  id: string;
  questionText: string;
  chapterNumberAtTime: number;
  createdAtMs: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  username: string;
};

const bookScope = (ownerId: string) => ({
  ownerId,
  deletedAt: null,
});

export function parsePartnerQueriesTake(raw: string | null, fallback = PARTNER_QUERIES_PAGE_SIZE): number {
  if (raw === null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, PARTNER_QUERIES_TAKE_MAX);
}

export async function queryPartnerQueriesPage(args: {
  ownerId: string;
  skip?: number;
  take?: number;
}): Promise<{ rows: PartnerQueryRow[]; hasMore: boolean }> {
  const skip = Math.max(0, args.skip ?? 0);
  const take = Math.min(
    Math.max(1, args.take ?? PARTNER_QUERIES_PAGE_SIZE),
    PARTNER_QUERIES_TAKE_MAX,
  );

  const rows = await prisma.query.findMany({
    where: { book: bookScope(args.ownerId) },
    orderBy: { createdAt: "desc" },
    skip,
    take: take + 1,
    select: {
      id: true,
      questionText: true,
      chapterNumberAtTime: true,
      createdAt: true,
      book: { select: { id: true, title: true, author: true } },
      user: { select: { username: true, name: true } },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    rows: page.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      chapterNumberAtTime: q.chapterNumberAtTime,
      createdAtMs: q.createdAt.getTime(),
      bookId: q.book.id,
      bookTitle: q.book.title,
      bookAuthor: q.book.author,
      username: q.user.username ?? q.user.name ?? "Reader",
    })),
    hasMore,
  };
}
