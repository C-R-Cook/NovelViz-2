"use client";

import type { BookStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: BookStatus;
  ownerLabel: string | null;
  /** Pre-formatted on the server to avoid locale hydration mismatches */
  createdAtLabel: string;
  chapterCount: number;
};

type FilterKey = "all" | BookStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "draft" },
  { key: "pending_review", label: "pending_review" },
  { key: "rejected", label: "rejected" },
  { key: "processing", label: "processing" },
  { key: "ready_for_review", label: "ready_for_review" },
  { key: "published", label: "published" },
  { key: "unlisted", label: "unlisted" },
];

export function StatusBadge({ status }: { status: BookStatus }) {
  const base = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";
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
          pending_review
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
    case "ready_for_review":
      return (
        <span className={`${base} bg-amber-500 text-zinc-950`}>
          ready_for_review
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

export function AdminBooksClient({ books }: { books: AdminBookRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return books;
    return books.filter((b) => b.status === filter);
  }, [books, filter]);

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
      router.refresh();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
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
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-amber-100/95 text-amber-950 ring-1 ring-amber-500/50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/40"
                  : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:text-zinc-200"
              }`}
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Chapters</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-500"
                >
                  No books match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((book) => (
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
                  <td className="px-4 py-3">
                    <StatusBadge status={book.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-800 dark:text-zinc-300">
                    {book.chapterCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-500">
                    {book.createdAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/books/${book.id}`}
                        className="inline-flex rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-amber-950 ring-1 ring-zinc-400 transition hover:bg-zinc-300 hover:ring-amber-700/40 dark:bg-zinc-800/80 dark:text-amber-100/90 dark:ring-zinc-700 dark:hover:bg-zinc-800 dark:hover:ring-amber-500/30"
                      >
                        Manage
                      </Link>
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
