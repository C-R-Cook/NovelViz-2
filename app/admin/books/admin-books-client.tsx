"use client";

import type { AdminBooksFilterKey, AdminBookRow } from "@/lib/admin-books-list";
import type { BookStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

export type { AdminBookRow } from "@/lib/admin-books-list";

type FilterKey = AdminBooksFilterKey;

type ListBooksResponse = {
  books: AdminBookRow[];
  hasMore: boolean;
  pageSize: number;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending_review", label: "Pending Review" },
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "rejected", label: "Rejected" },
  { key: "processing", label: "Processing" },
  { key: "published", label: "Published" },
  { key: "unlisted", label: "Unlisted" },
  { key: "deleted", label: "Deleted" },
];

function filterClassName(key: FilterKey, active: boolean): string {
  const base = "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1";
  if (key === "all") {
    return active
      ? `${base} bg-amber-100/95 text-amber-950 ring-amber-500/50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/40`
      : `${base} bg-zinc-100 text-zinc-600 ring-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:text-zinc-200`;
  }

  const palette: Record<BookStatus | "deleted", { light: string; dark: string }> = {
    draft: {
      light: "border-sky-400/80 bg-sky-100 text-sky-950 ring-sky-400/70 hover:bg-sky-200/80",
      dark: "dark:border-sky-700/50 dark:bg-sky-950/35 dark:text-sky-100 dark:ring-sky-700/60 dark:hover:bg-sky-950/55",
    },
    pending_review: {
      light: "border-indigo-400/80 bg-indigo-100 text-indigo-950 ring-indigo-400/70 hover:bg-indigo-200/80",
      dark: "dark:border-indigo-700/50 dark:bg-indigo-950/35 dark:text-indigo-100 dark:ring-indigo-700/60 dark:hover:bg-indigo-950/55",
    },
    rejected: {
      light: "border-red-400/80 bg-red-100 text-red-950 ring-red-400/70 hover:bg-red-200/80",
      dark: "dark:border-red-700/50 dark:bg-red-950/35 dark:text-red-100 dark:ring-red-700/60 dark:hover:bg-red-950/55",
    },
    processing: {
      light: "border-blue-400/80 bg-blue-100 text-blue-950 ring-blue-400/70 hover:bg-blue-200/80",
      dark: "dark:border-blue-700/50 dark:bg-blue-950/35 dark:text-blue-100 dark:ring-blue-700/60 dark:hover:bg-blue-950/55",
    },
    published: {
      light: "border-emerald-500/80 bg-emerald-100 text-emerald-950 ring-emerald-500/70 hover:bg-emerald-200/80",
      dark: "dark:border-emerald-700/50 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-700/60 dark:hover:bg-emerald-950/55",
    },
    unlisted: {
      light: "border-orange-400/80 bg-orange-100 text-orange-950 ring-orange-400/70 hover:bg-orange-200/80",
      dark: "dark:border-orange-700/50 dark:bg-orange-950/35 dark:text-orange-100 dark:ring-orange-700/60 dark:hover:bg-orange-950/55",
    },
    deleted: {
      light: "border-red-500/80 bg-red-100 text-red-950 ring-red-500/70 hover:bg-red-200/80",
      dark: "dark:border-red-700/50 dark:bg-red-950/35 dark:text-red-100 dark:ring-red-700/60 dark:hover:bg-red-950/55",
    },
  };

  const colors = palette[key];
  if (!colors) {
    return `${base} bg-zinc-100 text-zinc-600 ring-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:text-zinc-200`;
  }

  if (active) {
    return `${base} ${colors.light} ${colors.dark}`;
  }
  return `${base} bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950/60 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-900/60 border ${colors.light.split(" ").find((token) => token.startsWith("border-")) ?? "border-zinc-300"} ${colors.dark.split(" ").find((token) => token.startsWith("dark:border-")) ?? "dark:border-zinc-700"}`;
}

export function StatusBadge({ status, isDeleted = false }: { status: BookStatus; isDeleted?: boolean }) {
  const base =
    "inline-flex w-[8.0625rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1.5 py-1 text-xs font-medium leading-none tracking-tight";
  if (isDeleted) {
    return <span className={`${base} bg-red-700 text-red-50`}>Deleted</span>;
  }
  switch (status) {
    case "draft":
      return (
        <span className={`${base} bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200`}>
          draft
        </span>
      );
    case "pending_review":
      return (
        <span className={`${base} bg-indigo-600 text-indigo-50`}>
          Pending Review
        </span>
      );
    case "rejected":
      return (
        <span className={`${base} bg-red-600 text-red-50`}>
          rejected
        </span>
      );
    case "processing":
      return (
        <span
          className={`${base} animate-pulse bg-blue-600 text-blue-50 ring-2 ring-blue-400/40`}
        >
          processing
        </span>
      );
    case "published":
      return (
        <span className={`${base} bg-emerald-600 text-emerald-50`}>
          published
        </span>
      );
    case "unlisted":
      return (
        <span className={`${base} bg-orange-600 text-orange-50`}>unlisted</span>
      );
    default:
      return <span className={base}>{status}</span>;
  }
}

export function AdminBooksClient({
  initialBooks,
  initialFilter,
  initialHasMore,
  pageSize,
}: {
  initialBooks: AdminBookRow[];
  initialFilter: FilterKey;
  initialHasMore: boolean;
  pageSize: number;
}) {
  const listSeq = useRef(0);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks);
  const [hasMore, setHasMore] = useState(initialHasMore);
  /** Full-table skeleton only when switching filters (not after row actions). */
  const [filterLoading, setFilterLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [actionErr, setActionErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [catalogueWithdrawId, setCatalogueWithdrawId] = useState<string | null>(null);

  async function fetchBooks(
    spec: { filter: FilterKey; skip: number; mode: "replace" | "append" },
    /** Snapshot from `listSeq` — updates are skipped if stale */
    nonce: number,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      filter: spec.filter,
      skip: String(spec.skip),
    });

    let res: Response;
    try {
      res = await fetch(`/api/admin/books?${params.toString()}`);
    } catch {
      if (nonce === listSeq.current) setActionErr("Could not load books.");
      return false;
    }

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (nonce === listSeq.current) setActionErr(j.error ?? res.statusText);
      return false;
    }

    const data = (await res.json()) as ListBooksResponse;
    if (!Array.isArray(data.books)) {
      if (nonce === listSeq.current) setActionErr("Invalid response from server.");
      return false;
    }

    if (nonce !== listSeq.current) return true;

    if (spec.mode === "replace") {
      setBooks(data.books);
    } else {
      setBooks((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const appended = data.books.filter((b) => !seen.has(b.id));
        return [...prev, ...appended];
      });
    }
    setHasMore(data.hasMore);
    setActionErr(null);
    return true;
  }

  /** Bumps nonce so any in-flight “load more” is ignored before refetch */
  async function reloadCurrentFilter(): Promise<void> {
    const nonce = ++listSeq.current;
    await fetchBooks({ filter, skip: 0, mode: "replace" }, nonce);
  }

  async function selectFilter(next: FilterKey) {
    if (next === filter || filterLoading) return;
    const nonce = ++listSeq.current;
    setFilter(next);
    setFilterLoading(true);
    setBooks([]);
    setHasMore(false);
    try {
      await fetchBooks({ filter: next, skip: 0, mode: "replace" }, nonce);
    } finally {
      if (nonce === listSeq.current) setFilterLoading(false);
    }
  }

  async function loadMore(): Promise<boolean> {
    if (!hasMore || filterLoading || loadingMore) return false;
    const nonceStart = listSeq.current;
    setLoadingMore(true);
    try {
      return await fetchBooks(
        { filter, skip: books.length, mode: "append" },
        nonceStart,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function deleteBook(book: AdminBookRow) {
    const confirmed = window.confirm(
      `Delete "${book.title}" by ${book.author}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setActionErr(null);
    setDeletingId(book.id);
    try {
      const res = await fetch(`/api/admin/books/${book.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await reloadCurrentFilter();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  /** Same as partner “Remove from catalogue”: `published` → `unlisted`, no delete. */
  async function removeFromCatalogue(book: AdminBookRow) {
    const confirmed = window.confirm(
      `Remove "${book.title}" from the public catalogue? It will stay in the database as unlisted.`,
    );
    if (!confirmed) return;

    setActionErr(null);
    setCatalogueWithdrawId(book.id);
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "unlisted" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await reloadCurrentFilter();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Could not unlist");
    } finally {
      setCatalogueWithdrawId(null);
    }
  }

  async function restoreBook(book: AdminBookRow) {
    setActionErr(null);
    setRestoringId(book.id);
    try {
      const res = await fetch(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreDeleted: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await reloadCurrentFilter();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="font-serif text-2xl font-semibold text-amber-900 dark:text-amber-100/95">
            Books
          </h1>
          <Link
            href="/partner/books/new"
            className="inline-flex w-fit rounded-lg bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/35 transition hover:bg-amber-200/80 dark:bg-amber-200/10 dark:text-amber-100 dark:ring-amber-400/30 dark:hover:bg-amber-200/15"
          >
            New book
          </Link>
        </div>
        {actionErr ? (
          <p className="text-sm text-red-600 dark:text-red-400">{actionErr}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              disabled={filterLoading}
              aria-pressed={filter === key}
              onClick={() => void selectFilter(key)}
              className={filterClassName(key, filter === key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200/90 bg-white/90 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-500">
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Chapters</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {filterLoading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-500"
                >
                  Loading…
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-500"
                >
                  No books match this filter.
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr
                  key={book.id}
                  className="border-b border-zinc-200/80 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-2 align-middle">
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
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {book.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{book.author}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {book.ownerLabel ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={book.status} isDeleted={book.isDeleted} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-zinc-800 dark:text-zinc-300">
                    {book.chapterCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-500">
                    {book.createdAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!book.isDeleted ? (
                        <>
                          <Link
                            href={`/admin/books/${book.id}`}
                            className="inline-flex rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-amber-950 ring-1 ring-zinc-400 transition hover:bg-zinc-300 hover:ring-amber-700/40 dark:bg-zinc-800/80 dark:text-amber-100/90 dark:ring-zinc-700 dark:hover:bg-zinc-800 dark:hover:ring-amber-500/30"
                          >
                            Manage
                          </Link>
                          {book.status === "published" ? (
                            <button
                              type="button"
                              aria-label={`Remove ${book.title} from catalogue`}
                              disabled={
                                catalogueWithdrawId === book.id || deletingId === book.id
                              }
                              onClick={() => void removeFromCatalogue(book)}
                              className="inline-flex rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-orange-50 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {catalogueWithdrawId === book.id ? "Removing…" : "Remove from catalogue"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Delete ${book.title}`}
                            disabled={deletingId === book.id}
                            onClick={() => void deleteBook(book)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/80 bg-red-100 text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-4 w-4"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={restoringId === book.id}
                          onClick={() => void restoreBook(book)}
                          className="inline-flex rounded-lg border border-red-300/90 bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/60"
                        >
                          {restoringId === book.id ? "Restoring..." : "Restore"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!filterLoading && hasMore ? (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-lg bg-zinc-200 px-5 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 dark:hover:bg-zinc-700"
          >
            {loadingMore ? "Loading…" : `Load next ${pageSize}`}
          </button>
        </div>
      ) : !filterLoading && books.length > 0 ? (
        <p className="pt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">End of list</p>
      ) : null}
    </div>
  );
}
