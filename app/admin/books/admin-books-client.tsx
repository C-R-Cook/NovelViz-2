// TODO: deprecated — functionality moved to /dashboard tabs
"use client";

import { adminBookDetailHref } from "@/lib/admin-book-navigation";
import type {
  AdminBookRow,
  AdminBooksFilterKey,
  AdminBooksSortDirection,
  AdminBooksSortField,
} from "@/lib/admin-books-list";
import type { BookStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
    pending_review: `${base} border border-status-pending bg-status-pending/30 text-text-primary ring-status-pending/45`,
    rejected: `${base} border border-status-rejected bg-status-rejected/30 text-text-primary ring-status-rejected/45`,
    processing: `${base} border border-status-processing bg-status-processing/30 text-text-primary ring-status-processing/45`,
    published: `${base} border border-status-published bg-status-published/30 text-text-primary ring-status-published/45`,
    unlisted: `${base} border border-status-unlisted bg-status-unlisted/30 text-text-primary ring-status-unlisted/45`,
    deleted: `${base} border border-status-rejected bg-status-rejected/30 text-text-primary ring-status-rejected/45`,
  };

  const inactiveBorder: Record<BookStatus | "deleted", string> = {
    draft: "border-status-draft/50",
    pending_review: "border-status-pending/50",
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
  initialSort = "createdAt",
  initialSortDir = "desc",
  variant = "page",
  returnTo,
}: {
  initialBooks: AdminBookRow[];
  initialFilter: FilterKey;
  initialHasMore: boolean;
  pageSize: number;
  initialSort?: AdminBooksSortField;
  initialSortDir?: AdminBooksSortDirection;
  variant?: "page" | "embedded";
  /** List URL to return to after publishing from book detail. */
  returnTo?: string;
}) {
  const listSeq = useRef(0);
  const prevDebouncedSearch = useRef<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<AdminBooksSortField>(initialSort);
  const [sortDir, setSortDir] = useState<AdminBooksSortDirection>(initialSortDir);
  const [books, setBooks] = useState<AdminBookRow[]>(initialBooks);
  const [hasMore, setHasMore] = useState(initialHasMore);
  /** Full-table skeleton only when switching filters (not after row actions). */
  const [filterLoading, setFilterLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [actionErr, setActionErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  async function fetchBooks(
    spec: {
      filter: FilterKey;
      skip: number;
      mode: "replace" | "append";
      sort: AdminBooksSortField;
      dir: AdminBooksSortDirection;
      take: number;
      q?: string;
      includeDeleted: boolean;
    },
    /** Snapshot from `listSeq` — updates are skipped if stale */
    nonce: number,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      filter: spec.filter,
      skip: String(spec.skip),
      sort: spec.sort,
      dir: spec.dir,
      take: String(spec.take),
      includeDeleted: spec.includeDeleted ? "true" : "false",
    });
    if (spec.q) params.set("q", spec.q);

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
    await fetchBooks(
      {
        filter,
        skip: 0,
        mode: "replace",
        sort: sortField,
        dir: sortDir,
        take: pageSize,
        q: debouncedSearch || undefined,
        includeDeleted: showDeleted,
      },
      nonce,
    );
  }

  async function setShowDeletedAndReload(next: boolean) {
    if (next === showDeleted || filterLoading) return;
    const nextFilter: FilterKey = !next && filter === "deleted" ? "all" : filter;
    const nonce = ++listSeq.current;
    setShowDeleted(next);
    if (nextFilter !== filter) setFilter(nextFilter);
    setFilterLoading(true);
    setBooks([]);
    setHasMore(false);
    try {
      await fetchBooks(
        {
          filter: nextFilter,
          skip: 0,
          mode: "replace",
          sort: sortField,
          dir: sortDir,
          take: pageSize,
          q: debouncedSearch || undefined,
          includeDeleted: next,
        },
        nonce,
      );
    } finally {
      if (nonce === listSeq.current) setFilterLoading(false);
    }
  }

  useEffect(() => {
    if (prevDebouncedSearch.current === null) {
      prevDebouncedSearch.current = debouncedSearch;
      return;
    }
    if (prevDebouncedSearch.current === debouncedSearch) return;
    prevDebouncedSearch.current = debouncedSearch;

    const nonce = ++listSeq.current;
    setFilterLoading(true);
    setBooks([]);
    setHasMore(false);
    void fetchBooks(
      {
        filter,
        skip: 0,
        mode: "replace",
        sort: sortField,
        dir: sortDir,
        take: pageSize,
        q: debouncedSearch || undefined,
        includeDeleted: showDeleted,
      },
      nonce,
    ).finally(() => {
      if (nonce === listSeq.current) setFilterLoading(false);
    });
  }, [debouncedSearch, filter, sortField, sortDir, pageSize, showDeleted]);

  async function onSortHeaderClick(column: AdminBooksSortField) {
    if (filterLoading) return;

    let nextSort = column;
    let nextDir = sortDir;
    if (column === sortField) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
    } else {
      nextSort = column;
      nextDir =
        column === "createdAt" || column === "chapters" || column === "status"
          ? "desc"
          : column === "title" || column === "author" || column === "owner"
            ? "asc"
            : "desc";
      setSortField(column);
      setSortDir(nextDir);
    }

    const nonce = ++listSeq.current;
    setFilterLoading(true);
    setBooks([]);
    setHasMore(false);
    try {
      await fetchBooks(
        {
          filter,
          skip: 0,
          mode: "replace",
          sort: nextSort,
          dir: nextDir,
          take: pageSize,
          q: debouncedSearch || undefined,
          includeDeleted: showDeleted,
        },
        nonce,
      );
    } finally {
      if (nonce === listSeq.current) setFilterLoading(false);
    }
  }

  async function selectFilter(next: FilterKey) {
    if (next === filter || filterLoading) return;
    const nonce = ++listSeq.current;
    setFilter(next);
    setFilterLoading(true);
    setBooks([]);
    setHasMore(false);
    try {
      await fetchBooks(
        {
          filter: next,
          skip: 0,
          mode: "replace",
          sort: sortField,
          dir: sortDir,
          take: pageSize,
          q: debouncedSearch || undefined,
          includeDeleted: showDeleted,
        },
        nonce,
      );
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
        {
          filter,
          skip: books.length,
          mode: "append",
          sort: sortField,
          dir: sortDir,
          take: pageSize,
          q: debouncedSearch || undefined,
          includeDeleted: showDeleted,
        },
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

  function SortHead({
    field,
    label,
    alignCenter = false,
  }: {
    field: AdminBooksSortField;
    label: string;
    alignCenter?: boolean;
  }) {
    const active = sortField === field;
    const chevron = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        className={`px-4 py-3 font-medium ${alignCenter ? "text-center" : "text-start"}`}
        scope="col"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          disabled={filterLoading}
          title={`Sort by ${label}`}
          onClick={() => void onSortHeaderClick(field)}
          className={`inline-flex w-full items-center gap-0.5 text-xs uppercase tracking-wide transition hover:text-text-primary disabled:opacity-60 ${
            alignCenter ? "justify-center text-center" : "justify-start text-start"
          } ${active ? "text-accent-text" : "text-text-muted"}`}
        >
          {label}
          <span className="tabular-nums text-accent-text">{chevron}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/admin/t2i-tester" className="text-accent-text underline-offset-2 hover:underline">
          T2I Tester
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {variant === "page" ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-serif text-2xl font-semibold text-accent-text">Books</h1>
            <Link
              href="/partner/books/new"
              className="inline-flex w-fit rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/35 transition hover:bg-accent-hover/80"
            >
              New book
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-secondary">Browse and manage every book by status.</p>
            <Link
              href="/partner/books/new"
              className="inline-flex w-fit shrink-0 rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/35 transition hover:bg-accent-hover/80"
            >
              New book
            </Link>
          </div>
        )}
        {actionErr ? (
          <p className="text-sm text-error">{actionErr}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.filter(({ key }) => showDeleted || key !== "deleted").map(({ key, label }) => (
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
          <span className="mx-1 hidden h-6 w-px bg-border sm:inline" aria-hidden />
          <button
            type="button"
            disabled={filterLoading}
            aria-pressed={showDeleted}
            onClick={() => void setShowDeletedAndReload(!showDeleted)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1 ${
              showDeleted
                ? "bg-accent-muted text-accent-text ring-accent/50"
                : "bg-bg-surface text-text-muted ring-border hover:text-text-primary"
            }`}
          >
            Show deleted: {showDeleted ? "On" : "Off"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            aria-label="Search books"
            className="min-w-0 w-full flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:min-w-[220px]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {filterLoading ? (
        <p className="md:hidden py-8 text-center text-sm text-text-muted">Loading…</p>
      ) : books.length === 0 ? (
        <p className="md:hidden py-8 text-center text-sm text-text-muted">
          {debouncedSearch ? "No books match your search." : "No books match this filter."}
        </p>
      ) : (
        <ul className="md:hidden space-y-3">
          {books.map((book) => (
            <li
              key={book.id}
              className="rounded-xl border border-border/80 bg-bg-base/80 p-4"
            >
              <div className="flex gap-3">
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
                  {book.coverImageUrl ? (
                    <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="44px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-text-muted">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{book.title}</p>
                  <p className="text-sm text-text-secondary">{book.author}</p>
                  <p className="mt-1 text-xs text-text-muted">{book.ownerLabel ?? "Unassigned"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={book.status} isDeleted={book.isDeleted} />
                    <span className="text-xs tabular-nums text-text-muted">
                      {book.chapterCount} ch · {book.createdAtLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="admin-mobile-card-actions mt-3 flex flex-wrap gap-2">
                {!book.isDeleted ? (
                  <>
                    <Link
                      href={adminBookDetailHref(
                        book.id,
                        returnTo ??
                          (variant === "embedded"
                            ? "/dashboard?tab=all-books"
                            : `/admin/books?filter=${filter}`),
                      )}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border"
                    >
                      Manage
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${book.title}`}
                      disabled={deletingId === book.id}
                      onClick={() => void deleteBook(book)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-error/35 bg-error/15 text-error"
                    >
                      <span className="sr-only">Delete</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
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
                    className="w-full rounded-lg border border-error/35 bg-error/15 px-3 py-2 text-sm font-medium text-error"
                  >
                    {restoringId === book.id ? "Restoring..." : "Restore"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-bg-surface/90 md:block">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs">
              <th className="px-4 py-3 font-medium text-text-muted">Cover</th>
              <SortHead field="title" label="Title" />
              <SortHead field="author" label="Author" />
              <SortHead field="owner" label="Owner" />
              <SortHead field="status" label="Status" alignCenter />
              <SortHead field="chapters" label="Chapters" alignCenter />
              <SortHead field="createdAt" label="Created" />
              <th className="px-4 py-3 font-medium text-text-muted"> </th>
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
                  {debouncedSearch ? "No books match your search." : "No books match this filter."}
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
                            href={adminBookDetailHref(
                              book.id,
                              returnTo ??
                                (variant === "embedded"
                                  ? "/dashboard?tab=all-books"
                                  : `/admin/books?filter=${filter}`),
                            )}
                            className="inline-flex rounded-lg bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised hover:ring-accent/40"
                          >
                            Manage
                          </Link>
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
