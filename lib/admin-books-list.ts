import {
  ADMIN_BOOKS_PAGE_SIZE,
  ADMIN_BOOKS_TAKE_MAX,
  type AdminBookRow,
  type AdminBooksSortDirection,
  type AdminBooksSortField,
  type QueryAdminBooksPageArgs,
} from "@/lib/admin-books-shared";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@db";

export {
  ADMIN_BOOKS_PAGE_SIZE,
  ADMIN_BOOKS_SEARCH_MAX_LEN,
  ADMIN_BOOKS_TAKE_MAX,
  DASHBOARD_ADMIN_BOOKS_LIMIT,
  FOR_REVIEW_QUEUE_PAGE_SIZE,
  parseAdminBooksFilterParam,
  parseAdminBooksSearchParam,
  parseAdminBooksSortDirection,
  parseAdminBooksSortField,
  parseAdminBooksTakeParam,
  type AdminBookRow,
  type AdminBooksFilterKey,
  type AdminBooksSortDirection,
  type AdminBooksSortField,
  type QueryAdminBooksPageArgs,
} from "@/lib/admin-books-shared";

function adminBooksSearchWhere(q: string): Prisma.BookWhereInput {
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
    ],
  };
}

function prismaWhere(
  filter: QueryAdminBooksPageArgs["filter"],
  q?: string,
): Prisma.BookWhereInput {
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
    case "updatedAt":
      return { updatedAt: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}

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
