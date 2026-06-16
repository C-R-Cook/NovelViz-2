"use client";

import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import { StatusBadge } from "@/app/admin/books/admin-books-client";
import type { BookStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type ListResponse = {
  books: PartnerDashboardBookRow[];
  hasMore: boolean;
  pageSize: number;
};

type SortField = "title" | "author" | "status" | "readerCount" | "queryCount" | "imageCount";
type SortDir = "asc" | "desc";

const DASHBOARD_TAB = "my-books";

const ALL_STATUSES: BookStatus[] = [
  "draft",
  "pending_review",
  "rejected",
  "published",
  "unlisted",
  "processing",
];

function statusLabel(status: BookStatus): string {
  return status.replace(/_/g, " ");
}

export function PartnerDashboardBooksClient({
  initialBooks,
  initialHasMore,
  pageSize,
  variant = "table",
}: {
  initialBooks: PartnerDashboardBookRow[];
  initialHasMore: boolean;
  pageSize: number;
  variant?: "table" | "dashboard";
}) {
  const [books, setBooks] = useState(initialBooks);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = books.filter((book) => {
      if (statusFilter !== "all" && book.status !== statusFilter) return false;
      if (!q) return true;
      return book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q);
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "author":
          cmp = a.author.localeCompare(b.author);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "readerCount":
          cmp = a.readerCount - b.readerCount;
          break;
        case "queryCount":
          cmp = a.queryCount - b.queryCount;
          break;
        case "imageCount":
          cmp = a.imageCount - b.imageCount;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [books, search, sortField, sortDir, statusFilter]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "title" || field === "author" ? "asc" : "desc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const toolbar = (
    <div className="flex flex-wrap items-end gap-3 px-1 pb-2">
      <label className="flex min-w-[180px] flex-1 flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title or author…"
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Status</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BookStatus | "all")}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <p className="pb-2 text-xs text-text-muted">
        Showing {filteredBooks.length} of {books.length} loaded
      </p>
    </div>
  );

  if (books.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-text-secondary">
        You haven&apos;t uploaded any books yet.
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="space-y-4">
        {toolbar}
        {loadErr ? <p className="px-2 pt-2 text-sm text-error">{loadErr}</p> : null}
        <div className="dashboard-books-grid-head">
          <button type="button" className="text-left hover:text-accent-text" onClick={() => toggleSort("title")}>
            Book{sortIndicator("title")}
          </button>
          <button type="button" className="text-left hover:text-accent-text" onClick={() => toggleSort("status")}>
            Status{sortIndicator("status")}
          </button>
          <button
            type="button"
            className="text-center hover:text-accent-text"
            onClick={() => toggleSort("readerCount")}
          >
            Readers{sortIndicator("readerCount")}
          </button>
          <button
            type="button"
            className="text-center hover:text-accent-text"
            onClick={() => toggleSort("queryCount")}
          >
            Queries{sortIndicator("queryCount")}
          </button>
          <button
            type="button"
            className="text-center hover:text-accent-text"
            onClick={() => toggleSort("imageCount")}
          >
            Images{sortIndicator("imageCount")}
          </button>
          <span className="text-right">Actions</span>
        </div>
        {filteredBooks.length === 0 ? (
          <p className="px-2 py-6 text-sm text-text-muted">No books match your filters.</p>
        ) : (
          filteredBooks.map((book, i) => (
            <div
              key={book.id}
              className="dashboard-books-grid-row dashboard-stagger-item--x"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative h-[42px] w-8 shrink-0 overflow-hidden rounded border border-border-subtle bg-bg-surface">
                  {book.coverImageUrl ? (
                    <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="32px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-text-muted">-</div>
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/partner/books/${book.id}`}
                    className="block truncate font-serif text-sm text-text-primary hover:text-accent-text"
                  >
                    {book.title}
                  </Link>
                  <div className="truncate text-[10px] italic text-text-secondary">{book.author}</div>
                </div>
              </div>
              <div className="flex justify-start">
                <StatusBadge status={book.status} />
              </div>
              <div className="text-center font-mono text-xs tabular-nums text-accent/90">
                {book.readerCount.toLocaleString()}
              </div>
              <div className="text-center font-mono text-xs tabular-nums text-accent/90">
                {book.queryCount.toLocaleString()}
              </div>
              <div className="text-center font-mono text-xs tabular-nums text-accent/90">
                {book.imageCount.toLocaleString()}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <Link
                  href={`/partner/books/${book.id}/stats?from=${encodeURIComponent(`/dashboard?tab=${DASHBOARD_TAB}`)}`}
                  className="rounded border border-border px-2 py-1 font-mono text-[8px] uppercase tracking-wide text-text-secondary hover:border-accent/40"
                >
                  Stats
                </Link>
                <Link
                  href={`/partner/books/${book.id}`}
                  className="rounded border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-[8px] uppercase tracking-wide text-accent hover:bg-accent/20"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))
        )}

        {hasMore ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="rounded-lg bg-bg-raised px-5 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : `Load next ${pageSize}`}
            </button>
          </div>
        ) : (
          <p className="pb-2 text-center text-xs text-text-muted">End of list</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}
      {loadErr ? <p className="px-6 pt-4 text-sm text-error">{loadErr}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort("title")} className="hover:text-accent-text">
                  Book{sortIndicator("title")}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <button type="button" onClick={() => toggleSort("status")} className="hover:text-accent-text">
                  Status{sortIndicator("status")}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">Chapters</th>
              <th className="px-4 py-3 text-center font-medium">
                <button type="button" onClick={() => toggleSort("readerCount")} className="hover:text-accent-text">
                  Readers{sortIndicator("readerCount")}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <button type="button" onClick={() => toggleSort("queryCount")} className="hover:text-accent-text">
                  Queries{sortIndicator("queryCount")}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <button type="button" onClick={() => toggleSort("imageCount")} className="hover:text-accent-text">
                  Images{sortIndicator("imageCount")}
                </button>
              </th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book.id} className="border-b border-border/80 last:border-0">
                <td className="px-4 py-2">
                  <div className="relative h-14 w-10 overflow-hidden rounded border border-border bg-bg-surface">
                    {book.coverImageUrl ? (
                      <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-text-muted">-</div>
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
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{book.chapterCount}</td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{book.readerCount}</td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{book.queryCount}</td>
                <td className="px-4 py-3 text-center tabular-nums text-text-secondary">{book.imageCount}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/partner/books/${book.id}/stats?from=${encodeURIComponent(`/dashboard?tab=${DASHBOARD_TAB}`)}`}
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
