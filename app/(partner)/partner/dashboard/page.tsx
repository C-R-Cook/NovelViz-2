import { StatusBadge } from "@/app/admin/books/admin-books-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
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

  const books = await prisma.book.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          chapters: true,
          queries: true,
          generatedImages: true,
          userBooks: { where: { isActive: true } },
        },
      },
    },
  });

  const totals = books.reduce(
    (acc, b) => {
      acc.readers += b._count.userBooks;
      acc.queries += b._count.queries;
      acc.images += b._count.generatedImages;
      return acc;
    },
    { readers: 0, queries: 0, images: 0 },
  );

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
        <StatCard label="Total books" value={books.length} />
        <StatCard label="Total readers" value={totals.readers} />
        <StatCard label="Total queries" value={totals.queries} />
        <StatCard label="Total images generated" value={totals.images} />
      </section>

      <section className="rounded-xl border border-zinc-200/90 bg-white/90 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        {books.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
            You haven&apos;t uploaded any books yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-500">
                  <th className="px-4 py-3 font-medium">Cover</th>
                  <th className="px-4 py-3 font-medium">Book</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Chapters</th>
                  <th className="px-4 py-3 font-medium">Readers</th>
                  <th className="px-4 py-3 font-medium">Queries</th>
                  <th className="px-4 py-3 font-medium">Images</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr
                    key={book.id}
                    className="border-b border-zinc-200/80 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-2">
                      <div className="relative h-14 w-10 overflow-hidden rounded border border-zinc-300 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                        {book.coverImageUrl ? (
                          <Image
                            src={book.coverImageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-500 dark:text-zinc-600">
                            -
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {book.title}
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-400">{book.author}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={book.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {book._count.chapters}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {book._count.userBooks}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {book._count.queries}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {book._count.generatedImages}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/partner/books/${book.id}`}
                        className="inline-flex rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-amber-950 ring-1 ring-zinc-400 transition hover:bg-zinc-300 hover:ring-amber-700/40 dark:bg-zinc-800/80 dark:text-amber-100/90 dark:ring-zinc-700 dark:hover:bg-zinc-800 dark:hover:ring-amber-500/30"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
