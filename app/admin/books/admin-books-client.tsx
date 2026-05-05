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
      ? `${base} bg-accent-muted text-accent-text ring-accent/50`
      : `${base} bg-bg-surface text-text-muted ring-border hover:text-text-primary`;
  }

  const activeStyle: Record<BookStatus | "deleted", string> = {
    draft: `${base} border border-status-draft bg-status-draft/35 text-text-primary ring-status-draft/50`,
    pending_review: `${base} border border-status-ready bg-status-ready/30 text-text-primary ring-status-ready/45`,
    rejected: `${base} border border-status-rejected bg-status-rejected/30 text-text-primary ring-status-rejected/45`,
    processing: `${base} border border-status-processing bg-status-processing/30 text-text-primary ring-status-processing/45`,
    published: `${base} border border-status-published bg-status-published/30 text-text-primary ring-status-published/45`,
    unlisted: `${base} border border-status-unlisted bg-status-unlisted/30 text-text-primary ring-status-unlisted/45`,
    deleted: `${base} border border-status-rejected bg-status-rejected/30 text-text-primary ring-status-rejected/45`,
  };

  const inactiveBorder: Record<BookStatus | "deleted", string> = {
    draft: "border-status-draft/50",
    pending_review: "border-status-ready/50",
    rejected: "border-status-rejected/50",
    processing: "border-status-processing/50",
    published: "border-status-published/50",
    unlisted: "border-status-unlisted/50",
    deleted: "border-status-rejected/50",
  };

  const style = activeStyle[key];
  const ib = inactiveBorder[key];
  if (!style || !ib) {
    return `${base} bg-bg-surface text-text-muted ring-border hover:text-text-primary`;
  }

  if (active) {
    return style;
  }
  return `${base} border bg-bg-surface text-text-secondary ring-border hover:bg-bg-raised ${ib}`;
}

export function StatusBadge({ status, isDeleted = false }: { status: BookStatus; isDeleted?: boolean }) {
  const base =
    "inline-flex w-[8.0625rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1.5 py-1 text-xs font-medium leading-none tracking-tight";
  if (isDeleted) {
    return (
      <span className={`${base} bg-status-rejected text-text-primary`}>Deleted</span>
    );
  }
  switch (status) {
    case "draft":
      return (
        <span className={`${base} bg-status-draft text-text-primary`}>
          draft
        </span>
      );
    case "pending_review":
      return (
        <span className={`${base} bg-status-pending text-text-primary`}>
          Pending Review
        </span>
      );
    case "rejected":
      return (
        <span className={`${base} bg-status-rejected text-text-primary`}>
          rejected
        </span>
      );
    case "processing":
      return (
        <span
          className={`${base} animate-pulse bg-status-processing text-text-primary ring-2 ring-status-processing/40`}
        >
          processing
        </span>
      );
    case "published":
      return (
        <span className={`${base} bg-status-published text-text-primary`}>
          published
        </span>
      );
    case "unlisted":
      return (
        <span className={`${base} bg-status-unlisted text-text-primary`}>unlisted</span>
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
          <h1 className="font-serif text-2xl font-semibold text-accent-text">
            Books
          </h1>
          <Link
            href="/partner/books/new"
            className="inline-flex w-fit rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/35 transition hover:bg-accent-hover/80"
          >
            New book
          </Link>
        </div>
        {actionErr ? (
          <p className="text-sm text-error">{actionErr}</p>
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

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface/90">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
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
                  className="px-4 py-8 text-center text-text-muted"
                >
                  Loading…
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-text-muted"
                >
                  No books match this filter.
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr
                  key={book.id}
                  className="border-b border-border/80 last:border-0"
                >
                  <td className="px-4 py-2 align-middle">
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
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {book.title}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{book.author}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {book.ownerLabel ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={book.status} isDeleted={book.isDeleted} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-text-primary">
                    {book.chapterCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">
                    {book.createdAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!book.isDeleted ? (
                        <>
                          <Link
                            href={`/admin/books/${book.id}`}
                            className="inline-flex rounded-lg bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised hover:ring-accent/40"
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
                              className="inline-flex rounded-lg bg-status-unlisted px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-status-unlisted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {catalogueWithdrawId === book.id ? "Removing…" : "Remove from catalogue"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Delete ${book.title}`}
                            disabled={deletingId === book.id}
                            onClick={() => void deleteBook(book)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-error/35 bg-error/15 text-error transition hover:bg-error/25 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="inline-flex rounded-lg border border-error/35 bg-error/15 px-3 py-1.5 text-xs font-medium text-error transition hover:bg-error/25 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-lg bg-bg-raised px-5 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : `Load next ${pageSize}`}
          </button>
        </div>
      ) : !filterLoading && books.length > 0 ? (
        <p className="pt-4 text-center text-xs text-text-muted">End of list</p>
      ) : null}
    </div>
  );
}
