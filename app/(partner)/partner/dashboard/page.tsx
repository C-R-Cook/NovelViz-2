import { PartnerDashboardBooksClient } from "./partner-dashboard-books-client";
import { getCurrentUser } from "@/lib/auth";
import {
  PARTNER_BOOKS_PAGE_SIZE,
  fetchPartnerDashboardStats,
  queryPartnerBooksPage,
} from "@/lib/partner-books-list";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Partner Dashboard | NovelViz",
};

export default async function PartnerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const [stats, page0] = await Promise.all([
    fetchPartnerDashboardStats(dbUser.id),
    queryPartnerBooksPage({ ownerId: dbUser.id, skip: 0 }),
  ]);

  const { rows, hasMore } = page0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-amber-900 dark:text-amber-100/95">
            Partner Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your books, ingestion, and publishing workflow.
          </p>
        </div>
        <Link
          href="/partner/books/new"
          className="rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/35 transition hover:bg-amber-200/90 dark:bg-amber-200/10 dark:text-amber-100 dark:ring-amber-400/30 dark:hover:bg-amber-200/15"
        >
          Upload New Book
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total books" value={stats.totalBooks} />
        <StatCard label="Total readers" value={stats.totalReaders} />
        <StatCard label="Total queries" value={stats.totalQueries} />
        <StatCard label="Total images generated" value={stats.totalImages} />
      </section>

      <section className="rounded-xl border border-zinc-200/90 bg-white/90 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <PartnerDashboardBooksClient
          initialBooks={rows}
          initialHasMore={hasMore}
          pageSize={PARTNER_BOOKS_PAGE_SIZE}
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white/85 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/35">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
