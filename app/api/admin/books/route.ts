import {
  ADMIN_BOOKS_PAGE_SIZE,
  parseAdminBooksFilterParam,
  parseAdminBooksSortDirection,
  parseAdminBooksSortField,
  parseAdminBooksTakeParam,
  queryAdminBooksPage,
} from "@/lib/admin-books-list";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

/** Paginated catalogue for admins (filter + skip). Defaults to Pending Review when `filter` is omitted. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filter = parseAdminBooksFilterParam(url.searchParams.get("filter"));
  const skipRaw = url.searchParams.get("skip");
  const parsed = skipRaw === null || skipRaw === "" ? 0 : Number.parseInt(skipRaw, 10);
  const skip = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const take = parseAdminBooksTakeParam(url.searchParams.get("take"), ADMIN_BOOKS_PAGE_SIZE);
  const sort = parseAdminBooksSortField(url.searchParams.get("sort"));
  const dir = parseAdminBooksSortDirection(url.searchParams.get("dir"));

  const { rows, hasMore } = await queryAdminBooksPage({
    filter,
    skip,
    take,
    sort,
    dir,
  });
  return NextResponse.json({
    books: rows,
    hasMore,
    pageSize: take,
    sort,
    dir,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  void request;
  return NextResponse.json(
    { error: "Book creation is centralized at /partner/books/new" },
    { status: 403 },
  );
}
