// TODO: deprecated — functionality moved to /dashboard tabs
import {
  ADMIN_BOOKS_PAGE_SIZE,
  queryAdminBooksPage,
  type AdminBooksFilterKey,
} from "@/lib/admin-books-list";
import { AdminBooksClient } from "./admin-books-client";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminBooksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const initialFilter: AdminBooksFilterKey = "pending_review";
  const { rows, hasMore } = await queryAdminBooksPage({
    filter: initialFilter,
    skip: 0,
  });

  return (
    <AdminBooksClient
      initialBooks={rows}
      initialFilter={initialFilter}
      initialHasMore={hasMore}
      pageSize={ADMIN_BOOKS_PAGE_SIZE}
    />
  );
}
