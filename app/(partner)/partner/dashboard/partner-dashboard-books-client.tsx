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
      <div className="px-6 py-10 text-center text-sm text-text-secondary">
        You haven&apos;t uploaded any books yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadErr ? (
        <p className="px-6 pt-4 text-sm text-error">{loadErr}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Book</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Chapters</th>
              <th className="px-4 py-3 text-center font-medium">Readers</th>
              <th className="px-4 py-3 text-center font-medium">Queries</th>
              <th className="px-4 py-3 text-center font-medium">Images</th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr
                key={book.id}
                className="border-b border-border/80 last:border-0"
              >
                <td className="px-4 py-2">
                  <div className="relative h-14 w-10 overflow-hidden rounded border border-border bg-bg-surface">
                    {book.coverImageUrl ? (
                      <Image
                        src={book.coverImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                        -
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">{book.title}</div>
                  <div className="text-text-secondary">{book.author}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={book.status} />
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                  {book.chapterCount}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                  {book.readerCount}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                  {book.queryCount}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                  {book.imageCount}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/partner/books/${book.id}/stats?from=${encodeURIComponent("/dashboard?tab=my-books")}`}
                    className="inline-flex rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:border-accent/40 hover:bg-bg-raised"
                  >
                    Stats
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/partner/books/${book.id}`}
                    className="inline-flex rounded-lg bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised hover:ring-accent/40"
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
            className="rounded-lg bg-bg-raised px-5 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : `Load next ${pageSize}`}
          </button>
        </div>
      ) : (
        <p className="pb-6 text-center text-xs text-text-muted">End of list</p>
      )}
    </div>
  );
}
