"use client";

import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import { StatusBadge } from "@/app/admin/books/admin-books-client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type ListResponse = {
  books: PartnerDashboardBookRow[];
  hasMore: boolean;
  pageSize: number;
};

export function PartnerDashboardBooksClient({
  initialBooks,
  initialHasMore,
  pageSize,
}: {
  initialBooks: PartnerDashboardBookRow[];
  initialHasMore: boolean;
  pageSize: number;
}) {
  const [books, setBooks] = useState(initialBooks);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    const skip = books.length;
    setLoadingMore(true);
    setLoadErr(null);
    try {
      const params = new URLSearchParams({ skip: String(skip) });
      const res = await fetch(`/api/partner/books?${params}`);
      const j = (await res.json()) as ListResponse & { error?: string };
      if (!res.ok) {
        setLoadErr(j.error ?? res.statusText);
        return;
      }
      if (!Array.isArray(j.books)) {
        setLoadErr("Invalid response from server.");
        return;
      }
      setBooks((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const next = j.books.filter((b) => !seen.has(b.id));
        return [...prev, ...next];
      });
      setHasMore(Boolean(j.hasMore));
    } catch {
      setLoadErr("Could not load more books.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (books.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
        You haven&apos;t uploaded any books yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadErr ? (
        <p className="px-6 pt-4 text-sm text-red-600 dark:text-red-400">{loadErr}</p>
      ) : null}
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
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{book.title}</div>
                  <div className="text-zinc-600 dark:text-zinc-400">{book.author}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={book.status} />
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {book.chapterCount}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {book.readerCount}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {book.queryCount}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {book.imageCount}
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

      {hasMore ? (
        <div className="flex justify-center pb-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-lg bg-zinc-200 px-5 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 dark:hover:bg-zinc-700"
          >
            {loadingMore ? "Loading…" : `Load next ${pageSize}`}
          </button>
        </div>
      ) : (
        <p className="pb-6 text-center text-xs text-zinc-500 dark:text-zinc-500">End of list</p>
      )}
    </div>
  );
}
