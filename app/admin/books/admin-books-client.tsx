"use client";

import type { BookStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: BookStatus;
  /** Pre-formatted on the server to avoid locale hydration mismatches */
  createdAtLabel: string;
  chapterCount: number;
};

type FilterKey = "all" | BookStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "draft" },
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
        <span className={`${base} bg-zinc-700 text-zinc-200`}>draft</span>
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
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return books;
    return books.filter((b) => b.status === filter);
  }, [books, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl font-semibold text-amber-100/95">
          Books
        </h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-amber-200/15 text-amber-100 ring-1 ring-amber-400/40"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Author</th>
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
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No books match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((book) => (
                <tr
                  key={book.id}
                  className="border-b border-zinc-800/60 last:border-0"
                >
                  <td className="px-4 py-2 align-middle">
                    <div className="relative h-14 w-10 overflow-hidden rounded border border-zinc-800 bg-zinc-950">
                      {book.coverImageUrl ? (
                        <Image
                          src={book.coverImageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {book.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{book.author}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={book.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-300">
                    {book.chapterCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-500">
                    {book.createdAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className="inline-flex rounded-lg bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-amber-100/90 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:ring-amber-500/30"
                    >
                      Manage
                    </Link>
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
