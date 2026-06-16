"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type DashboardLibraryBookRow = {
  bookId: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  currentChapterNumber: number | null;
  chapterCount: number;
  queryCount: number;
  imageCount: number;
  progressPercent: number;
};

type Props = {
  stats: { libraryBookCount: number; queryCount: number; generatedImageCount: number };
  libraryBooks: DashboardLibraryBookRow[];
  reducedMotion: boolean;
};

function KpiCard({
  label,
  value,
  sub,
  delayMs = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delayMs?: number;
}) {
  return (
    <div
      className="dashboard-kpi dashboard-stagger-item"
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <div className="dashboard-kpi-label">{label}</div>
      <div className="dashboard-kpi-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub ? <div className="dashboard-kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function DashboardLibrarySettings({ stats, libraryBooks: initialBooks, reducedMotion }: Props) {
  const router = useRouter();
  const [books, setBooks] = useState(initialBooks);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = books.length > 0 && selected.size === books.length;
  const someSelected = selected.size > 0;

  const toggleOne = useCallback((bookId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (books.length === 0) return prev;
      if (prev.size === books.length) return new Set();
      return new Set(books.map((b) => b.bookId));
    });
  }, [books]);

  const removeBooks = useCallback(
    async (bookIds: string[]) => {
      if (bookIds.length === 0) return;
      setError(null);
      const results = await Promise.all(
        bookIds.map(async (bookId) => {
          const res = await fetch(`/api/library/${encodeURIComponent(bookId)}`, { method: "DELETE" });
          return { bookId, ok: res.ok };
        }),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(`Could not remove ${failed.length} book${failed.length === 1 ? "" : "s"}.`);
      }
      const removed = new Set(results.filter((r) => r.ok).map((r) => r.bookId));
      if (removed.size > 0) {
        setBooks((prev) => prev.filter((b) => !removed.has(b.bookId)));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of removed) next.delete(id);
          return next;
        });
        router.refresh();
      }
    },
    [router],
  );

  const removeOne = useCallback(
    async (bookId: string) => {
      setBusy(bookId);
      try {
        await removeBooks([bookId]);
      } finally {
        setBusy(null);
      }
    },
    [removeBooks],
  );

  const removeSelected = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await removeBooks(ids);
    } finally {
      setBulkBusy(false);
    }
  }, [removeBooks, selected]);

  const liveStats = useMemo(
    () => ({
      libraryBookCount: books.length,
      queryCount: stats.queryCount,
      generatedImageCount: stats.generatedImageCount,
    }),
    [books.length, stats.queryCount, stats.generatedImageCount],
  );

  return (
    <div className="space-y-6">
      <div className="dashboard-kpi-grid dashboard-kpi-grid--3">
        <KpiCard
          label="Books in library"
          value={liveStats.libraryBookCount}
          sub="Active in your library"
          delayMs={reducedMotion ? 0 : 80}
        />
        <KpiCard
          label="Q&A sessions"
          value={liveStats.queryCount}
          sub="Questions asked"
          delayMs={reducedMotion ? 0 : 140}
        />
        <KpiCard
          label="Images created"
          value={liveStats.generatedImageCount}
          sub="Across all books"
          delayMs={reducedMotion ? 0 : 200}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {books.length} book{books.length === 1 ? "" : "s"} in your library
        </p>
        {someSelected ? (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void removeSelected()}
            className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-sm font-medium text-error transition hover:bg-error/15 disabled:opacity-50"
          >
            {bulkBusy ? "Removing…" : `Remove selected (${selected.size})`}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {books.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No books in your library yet.{" "}
          <Link href="/discover" className="font-medium text-accent-text underline-offset-2 hover:underline">
            Browse Discover
          </Link>{" "}
          to add one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface/50 text-xs uppercase tracking-wide text-text-muted">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all books"
                    className="h-4 w-4 rounded border-border accent-[var(--accent)]"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Book</th>
                <th className="px-3 py-3 text-center font-medium">Chapter</th>
                <th className="px-3 py-3 text-center font-medium">Q&A</th>
                <th className="px-3 py-3 text-center font-medium">Images</th>
                <th className="px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.bookId} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(book.bookId)}
                      onChange={() => toggleOne(book.bookId)}
                      aria-label={`Select ${book.title}`}
                      className="h-4 w-4 rounded border-border accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-border-subtle bg-bg-surface">
                        {book.coverImageUrl ? (
                          <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-text-muted">—</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/library?book=${book.bookId}`}
                          className="block truncate font-serif text-sm text-text-primary hover:text-accent-text"
                        >
                          {book.title}
                        </Link>
                        <div className="truncate text-xs text-text-secondary">{book.author}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-text-secondary">
                    {book.currentChapterNumber != null
                      ? `${book.currentChapterNumber} / ${book.chapterCount}`
                      : `— / ${book.chapterCount}`}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-accent/90">
                    {book.queryCount}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-accent/90">
                    {book.imageCount}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/library?book=${book.bookId}`}
                        className="rounded border border-border px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide text-text-secondary hover:border-accent/40"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        disabled={busy === book.bookId || bulkBusy}
                        onClick={() => void removeOne(book.bookId)}
                        className="rounded border border-error/30 px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide text-error/90 hover:bg-error/10 disabled:opacity-50"
                      >
                        {busy === book.bookId ? "…" : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
