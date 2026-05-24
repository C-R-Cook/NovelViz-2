import { prisma } from "@/lib/prisma";
import type { BookStatus, ListingPreferenceAfterReview } from "@db";
import type { Prisma } from "@db";

/** Admin books table page size — standalone `/admin/books` — must match GET handler default cap when `take` omitted. */
export const ADMIN_BOOKS_PAGE_SIZE = 50;

/** Dashboard “All Books” tab — newest-first default, max rows per fetch. */
export const DASHBOARD_ADMIN_BOOKS_LIMIT = 20;

/** Hard cap per request (`take` query param clamped server-side). */
export const ADMIN_BOOKS_TAKE_MAX = 50;

/** Max length for admin book search query (`q` param). */
export const ADMIN_BOOKS_SEARCH_MAX_LEN = 100;

export type AdminBooksFilterKey = "all" | "deleted" | BookStatus;

export type AdminBooksSortField = "createdAt" | "title" | "author" | "owner" | "status" | "chapters";

export type AdminBooksSortDirection = Prisma.SortOrder;

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
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
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

const SORT_FIELDS = [
  "createdAt",
  "title",
  "author",
  "owner",
  "status",
  "chapters",
] as const satisfies readonly AdminBooksSortField[];

export function parseAdminBooksFilterParam(value: string | null): AdminBooksFilterKey {
  if (!value) return "pending_review";
  if ((FILTER_VALUES as readonly string[]).includes(value)) {
    return value as AdminBooksFilterKey;
  }
  return "pending_review";
}

export function parseAdminBooksTakeParam(value: string | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(ADMIN_BOOKS_TAKE_MAX, Math.floor(n));
}

export function parseAdminBooksSortField(value: string | null): AdminBooksSortField {
  if (value && (SORT_FIELDS as readonly string[]).includes(value)) {
    return value as AdminBooksSortField;
  }
  return "createdAt";
}

export function parseAdminBooksSortDirection(value: string | null): AdminBooksSortDirection {
  return value === "asc" ? "asc" : "desc";
}

export function parseAdminBooksSearchParam(value: string | null): string | undefined {
  if (value === null || value === "") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, ADMIN_BOOKS_SEARCH_MAX_LEN);
}

function adminBooksSearchWhere(q: string): Prisma.BookWhereInput {
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
    ],
  };
}

function prismaWhere(filter: AdminBooksFilterKey, q?: string): Prisma.BookWhereInput {
  const base: Prisma.BookWhereInput =
    filter === "all"
      ? {}
      : filter === "deleted"
        ? { deletedAt: { not: null } }
        : { deletedAt: null, status: filter };

  if (!q) return base;
  return { AND: [base, adminBooksSearchWhere(q)] };
}

function prismaOrderBy(
  sort: AdminBooksSortField,
  dir: AdminBooksSortDirection,
): Prisma.BookOrderByWithRelationInput {
  switch (sort) {
    case "title":
      return { title: dir };
    case "author":
      return { author: dir };
    case "status":
      return { status: dir };
    case "chapters":
      return { chapters: { _count: dir } };
    case "owner":
      return { owner: { email: dir } };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

export type QueryAdminBooksPageArgs = {
  filter: AdminBooksFilterKey;
  skip: number;
  /** Omit = {@link ADMIN_BOOKS_PAGE_SIZE}. */
  take?: number;
  sort?: AdminBooksSortField;
  dir?: AdminBooksSortDirection;
  /** Case-insensitive match on title or author. */
  q?: string;
};

/** One page (skip/take pagination). Uses `take+1` to detect `hasMore`. Sorted server-side by `sort` / `dir` (defaults: createdAt desc). */
export async function queryAdminBooksPage(
  params: QueryAdminBooksPageArgs,
): Promise<{ rows: AdminBookRow[]; hasMore: boolean }> {
  const take =
    typeof params.take === "number" && params.take >= 1
      ? Math.min(ADMIN_BOOKS_TAKE_MAX, params.take)
      : ADMIN_BOOKS_PAGE_SIZE;
  const safeSkip = Math.max(0, Number.isFinite(params.skip) ? params.skip : 0);
  const sort = params.sort ?? "createdAt";
  const dir = params.dir ?? "desc";

  const createdAtFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const raw = await prisma.book.findMany({
    where: prismaWhere(params.filter, params.q),
    orderBy: prismaOrderBy(sort, dir),
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
    listingPreferenceAfterReview: b.listingPreferenceAfterReview,
  }));

  return { rows, hasMore };
}
