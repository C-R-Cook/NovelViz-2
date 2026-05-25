"use client";

import type {
  CrossBookBulkChapterDeleteResult,
  PendingReviewBookChapterSearchRow,
} from "@/lib/admin-bulk-chapter-delete-pending";
import { adminBookDetailHref } from "@/lib/admin-book-navigation";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

function chapterLabel(m: { sequenceNumber: number; title: string | null }): string {
  return `#${m.sequenceNumber} ${m.title?.trim() || "Untitled"}`;
}

export function BulkChapterDeletePendingClient() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [books, setBooks] = useState<PendingReviewBookChapterSearchRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<CrossBookBulkChapterDeleteResult | null>(null);

  const selectableBooks = useMemo(
    () => books.filter((b) => !b.wouldDeleteAllChapters && b.status !== "processing"),
    [books],
  );

  const selectedBooks = useMemo(
    () => selectableBooks.filter((b) => selected.has(b.bookId)),
    [selectableBooks, selected],
  );

  const selectedChapterCount = useMemo(
    () => selectedBooks.reduce((n, b) => n + b.matches.length, 0),
    [selectedBooks],
  );

  const allSelectableSelected =
    selectableBooks.length > 0 && selectableBooks.every((b) => selected.has(b.bookId));

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setSearchErr("Enter a word or phrase to search chapter titles.");
      return;
    }
    setSearching(true);
    setSearchErr(null);
    setDeleteErr(null);
    setDeleteResult(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/admin/chapters/bulk-delete?q=${encodeURIComponent(q)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        titleQuery?: string;
        books?: PendingReviewBookChapterSearchRow[];
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      setSearchedQuery(data.titleQuery ?? q);
      setBooks(data.books ?? []);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : "Search failed");
      setBooks([]);
      setSearchedQuery("");
    } finally {
      setSearching(false);
    }
  }, [query]);

  function toggleBook(bookId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function selectAllSelectable() {
    setSelected(new Set(selectableBooks.map((b) => b.bookId)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (selected.size === 0 || !searchedQuery) return;

    const preview = selectedBooks
      .slice(0, 6)
      .map((b) => `${b.bookTitle} (${b.matches.length} ch.)`)
      .join("\n");
    const more =
      selectedBooks.length > 6 ? `\n…and ${selectedBooks.length - 6} more books` : "";

    if (
      !confirm(
        `Delete ${selectedChapterCount} matching chapter${selectedChapterCount === 1 ? "" : "s"} across ${selected.size} book${selected.size === 1 ? "" : "s"}?\n\nPhrase: “${searchedQuery}”\n\n${preview}${more}\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleteBusy(true);
    setDeleteErr(null);
    setDeleteResult(null);
    try {
      const res = await fetch("/api/admin/chapters/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleQuery: searchedQuery,
          bookIds: [...selected],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CrossBookBulkChapterDeleteResult & {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }

      setDeleteResult(data);
      setSelected(new Set());
      if (searchedQuery) {
        setSearching(true);
        try {
          const refresh = await fetch(
            `/api/admin/chapters/bulk-delete?q=${encodeURIComponent(searchedQuery)}`,
          );
          const refreshed = (await refresh.json()) as { books?: PendingReviewBookChapterSearchRow[] };
          if (refresh.ok) setBooks(refreshed.books ?? []);
        } finally {
          setSearching(false);
        }
      }
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Chapter title contains
          </span>
          <div className="flex flex-wrap items-end gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder='e.g. Contents'
              className="min-w-[12rem] flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
            />
            <button
              type="button"
              disabled={searching || deleteBusy}
              onClick={() => void runSearch()}
              className="rounded-lg border border-accent/35 bg-accent/10 px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent/20 disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search pending review"}
            </button>
          </div>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          Only books in <span className="font-medium">pending review</span> are searched.
        </p>
      </div>

      {searchErr ? <p className="text-sm text-error">{searchErr}</p> : null}

      {searchedQuery && !searching ? (
        <p className="text-sm text-text-secondary">
          <span className="font-medium tabular-nums text-text-primary">{books.length}</span> book
          {books.length === 1 ? "" : "s"} with chapters matching &ldquo;
          <span className="text-text-primary">{searchedQuery}</span>&rdquo;
          {books.length === 0 ? "." : ` · ${selectableBooks.length} eligible for delete`}
        </p>
      ) : null}

      {books.length > 0 ? (
        <div className="rounded-xl border border-border bg-bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-text-primary">
              {selected.size} book{selected.size === 1 ? "" : "s"} selected
              {selected.size > 0 ? (
                <span className="font-normal text-text-muted">
                  {" "}
                  · {selectedChapterCount} chapter{selectedChapterCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deleteBusy || selectableBooks.length === 0}
                onClick={selectAllSelectable}
                className="rounded-lg border border-border bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-surface disabled:opacity-50"
              >
                {allSelectableSelected ? "All eligible selected" : "Select all eligible"}
              </button>
              <button
                type="button"
                disabled={deleteBusy || selected.size === 0}
                onClick={clearSelection}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={deleteBusy || selected.size === 0}
                onClick={() => void deleteSelected()}
                className="rounded-lg bg-error/15 px-3 py-1.5 text-xs font-medium text-error ring-1 ring-error/35 hover:bg-error/25 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : `Delete from selected (${selected.size})`}
              </button>
            </div>
          </div>
          <ul className="max-h-[min(65vh,560px)] divide-y divide-border overflow-y-auto">
            {books.map((book) => {
              const disabled =
                book.wouldDeleteAllChapters || book.status === "processing" || deleteBusy;
              const checked = selected.has(book.bookId);
              return (
                <li key={book.bookId} className="px-4 py-3">
                  <label
                    className={`flex cursor-pointer items-start gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-bg-base/40"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleBook(book.bookId)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Link
                          href={adminBookDetailHref(book.bookId, "/dashboard?tab=for-review")}
                          className="font-medium text-accent-text underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {book.bookTitle}
                        </Link>
                        <span className="text-xs text-text-muted">{book.bookAuthor}</span>
                      </span>
                      <span className="mt-1 block text-xs text-text-secondary">
                        {book.matches.length} of {book.totalChapterCount} chapters match
                        {book.wouldDeleteAllChapters ? (
                          <span className="text-error"> — cannot delete all chapters</span>
                        ) : null}
                        {book.status === "processing" ? (
                          <span className="text-text-muted"> — ingestion in progress</span>
                        ) : null}
                      </span>
                      <ul className="mt-2 space-y-0.5 text-xs text-text-muted">
                        {book.matches.slice(0, 5).map((m) => (
                          <li key={m.chapterId}>{chapterLabel(m)}</li>
                        ))}
                        {book.matches.length > 5 ? (
                          <li>+ {book.matches.length - 5} more</li>
                        ) : null}
                      </ul>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : searchedQuery && !searching ? (
        <p className="text-sm text-text-muted">No pending-review books have chapters with that title.</p>
      ) : null}

      {deleteErr ? <p className="text-sm text-error">{deleteErr}</p> : null}

      {deleteResult ? (
        <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-success">
            Deleted {deleteResult.chaptersDeleted} chapter
            {deleteResult.chaptersDeleted === 1 ? "" : "s"} across {deleteResult.booksProcessed} book
            {deleteResult.booksProcessed === 1 ? "" : "s"}.
          </p>
          {deleteResult.results.some((r) => r.skipped || r.failed.length > 0) ? (
            <ul className="mt-2 space-y-1 text-text-secondary">
              {deleteResult.results
                .filter((r) => r.skipped || r.failed.length > 0 || r.deletedCount === 0)
                .map((r) => (
                  <li key={r.bookId}>
                    <span className="font-medium text-text-primary">{r.bookTitle}</span>
                    {r.skipped ? (
                      <span className="text-text-muted"> — {r.skipped}</span>
                    ) : r.failed.length > 0 ? (
                      <span className="text-error"> — {r.failed[0]!.error}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Link
        href="/dashboard?tab=for-review"
        className="inline-flex rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-surface"
      >
        ← Back to for review queue
      </Link>
    </div>
  );
}
