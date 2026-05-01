import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";
import type { Prisma } from "@db";

/** Admin books table page size — must match GET handler cap. */
export const ADMIN_BOOKS_PAGE_SIZE = 50;

export type AdminBooksFilterKey = "all" | "deleted" | BookStatus;

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: BookStatus;
  isDeleted: boolean;
  ownerLabel: string | null;
  /** Pre-formatted server-side */
  createdAtLabel: string;
  chapterCount: number;
};

const FILTER_VALUES: readonly AdminBooksFilterKey[] = [
  "all",
  "deleted",
  "draft",
  "pending_review",
  "rejected",
  "processing",
  "published",
  "unlisted",
];

export function parseAdminBooksFilterParam(value: string | null): AdminBooksFilterKey {
  if (!value) return "pending_review";
  if ((FILTER_VALUES as readonly string[]).includes(value)) {
    return value as AdminBooksFilterKey;
  }
  return "pending_review";
}

function prismaWhere(filter: AdminBooksFilterKey): Prisma.BookWhereInput {
  if (filter === "all") return {};
  if (filter === "deleted") return { deletedAt: { not: null } };
  return { deletedAt: null, status: filter };
}

/** One page ordered by newest first (skip/take pagination). Uses `take+1` to detect `hasMore`. */
export async function queryAdminBooksPage(params: {
  filter: AdminBooksFilterKey;
  skip: number;
}): Promise<{ rows: AdminBookRow[]; hasMore: boolean }> {
  const take = ADMIN_BOOKS_PAGE_SIZE;
  const safeSkip = Math.max(0, Number.isFinite(params.skip) ? params.skip : 0);

  const createdAtFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const raw = await prisma.book.findMany({
    where: prismaWhere(params.filter),
    orderBy: { createdAt: "desc" },
    skip: safeSkip,
    take: take + 1,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { chapters: true } },
    },
  });

  const hasMore = raw.length > take;
  const slice = hasMore ? raw.slice(0, take) : raw;

  const rows: AdminBookRow[] = slice.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverImageUrl: b.coverImageUrl,
    status: b.status,
    isDeleted: b.deletedAt !== null,
    ownerLabel: b.owner ? (b.owner.name ?? b.owner.email) : null,
    createdAtLabel: createdAtFormatter.format(b.createdAt),
    chapterCount: b._count.chapters,
  }));

  return { rows, hasMore };
}
