"use client";

import { adminBookDetailHref } from "@/lib/admin-book-navigation";
import type { AdminBookRow } from "@/lib/admin-books-list";
import type { ListingPreferenceAfterReview } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ForReviewBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
};

function toForReviewBook(book: AdminBookRow): ForReviewBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverImageUrl: book.coverImageUrl,
    listingPreferenceAfterReview: book.listingPreferenceAfterReview,
  };
}

export function ForReviewQueue({
  pendingBooks,
  pendingReviewCount,
  actionId,
  onModeration,
  className,
  returnTo = "/dashboard?tab=for-review",
}: {
  pendingBooks: ForReviewBook[];
  pendingReviewCount?: number;
  actionId: string | null;
  onModeration: (
    bookId: string,
    payload: { status: "published" | "unlisted" | "rejected"; rejectionReason?: string },
  ) => void;
  /** Optional wrapper class for dashboard shell layout. */
  className?: string;
  returnTo?: string;
}) {
  const [rejectBook, setRejectBook] = useState<ForReviewBook | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectErr, setRejectErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchBooks, setSearchBooks] = useState<ForReviewBook[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const prevDebouncedSearch = useRef<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (prevDebouncedSearch.current === null) {
      prevDebouncedSearch.current = debouncedSearch;
      return;
    }
    if (prevDebouncedSearch.current === debouncedSearch) return;
    prevDebouncedSearch.current = debouncedSearch;

    if (!debouncedSearch) {
      setSearchBooks(null);
      setSearchErr(null);
      setSearchLoading(false);
      return;
    }

    const nonce = ++searchSeq.current;
    setSearchLoading(true);
    setSearchErr(null);

    const params = new URLSearchParams({
      filter: "pending_review",
      skip: "0",
      take: "50",
      sort: "createdAt",
      dir: "desc",
      q: debouncedSearch,
    });

    void fetch(`/api/admin/books?${params.toString()}`)
      .then(async (res) => {
        if (nonce !== searchSeq.current) return;
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setSearchErr(j.error ?? res.statusText);
          setSearchBooks([]);
          return;
        }
        const data = (await res.json()) as { books?: AdminBookRow[] };
        setSearchBooks(Array.isArray(data.books) ? data.books.map(toForReviewBook) : []);
        setSearchErr(null);
      })
      .catch(() => {
        if (nonce !== searchSeq.current) return;
        setSearchErr("Could not search books.");
        setSearchBooks([]);
      })
      .finally(() => {
        if (nonce === searchSeq.current) setSearchLoading(false);
      });
  }, [debouncedSearch]);

  function moderateBook(
    bookId: string,
    payload: { status: "published" | "unlisted" | "rejected"; rejectionReason?: string },
  ) {
    onModeration(bookId, payload);
    setSearchBooks((prev) => (prev ? prev.filter((book) => book.id !== bookId) : prev));
  }

  const searchActive = debouncedSearch.length > 0;
  const displayBooks = searchActive ? (searchBooks ?? []) : pendingBooks;
  const totalPending = pendingReviewCount ?? pendingBooks.length;

  const subtitle = searchActive
    ? searchLoading
      ? `Searching for "${debouncedSearch}"…`
      : `${displayBooks.length} result${displayBooks.length === 1 ? "" : "s"} for "${debouncedSearch}"`
    : totalPending > pendingBooks.length
      ? `Books awaiting moderation (${pendingBooks.length} shown of ${totalPending}).`
      : `Books awaiting moderation (${pendingBooks.length} shown).`;

  function openReject(book: ForReviewBook) {
    setRejectBook(book);
    setRejectReason("");
    setRejectErr(null);
  }

  function closeReject() {
    setRejectBook(null);
    setRejectReason("");
    setRejectErr(null);
  }

  function submitReject() {
    if (!rejectBook) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 20) {
      setRejectErr("Reason for rejection must be at least 20 characters.");
      return;
    }
    onModeration(rejectBook.id, { status: "rejected", rejectionReason: trimmed });
    setSearchBooks((prev) => (prev ? prev.filter((book) => book.id !== rejectBook.id) : prev));
    closeReject();
  }

  return (
    <>
      <section aria-labelledby="for-review-queue-heading" className={className ? `${className} space-y-4` : "space-y-4"}>
        <div>
          <h2 id="for-review-queue-heading" className="text-lg font-semibold text-text-primary">
            For review
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            aria-label="Search books awaiting approval"
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
        {searchErr ? <p className="text-sm text-error">{searchErr}</p> : null}
        {searchActive && searchLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : displayBooks.length === 0 ? (
          <p className="text-sm text-text-muted">
            {searchActive ? `No books found for "${debouncedSearch}".` : "No books are pending review."}
          </p>
        ) : (
          <ul className="space-y-4">
            {displayBooks.map((book) => (
              <li
                key={book.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border/80 bg-bg-base/80 p-4"
              >
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
                </div>
                <div className="dashboard-for-review-actions dashboard-admin-queue-actions flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionId === book.id}
                    className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-success/100 disabled:opacity-50"
                    onClick={() =>
                      moderateBook(book.id, {
                        status: (book.listingPreferenceAfterReview ?? "published") as "published" | "unlisted",
                      })
                    }
                  >
                    {actionId === book.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={actionId === book.id}
                    className="rounded-lg border border-error/40 bg-transparent px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                    onClick={() => openReject(book)}
                  >
                    Reject
                  </button>
                  <Link
                    href={adminBookDetailHref(book.id, returnTo)}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-surface"
                  >
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {rejectBook ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-reject-book-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeReject();
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-bg-surface p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="dashboard-reject-book-title" className="text-lg font-semibold text-text-primary">
              Reject Book
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              This will notify the partner and set the book back to draft
            </p>
            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">Reason for rejection</span>
              <textarea
                rows={5}
                value={rejectReason}
                autoFocus
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                placeholder="Explain what needs to change (minimum 20 characters)."
              />
            </label>
            <p className="mt-1 text-xs text-text-secondary">
              {rejectReason.trim().length < 20
                ? `${20 - rejectReason.trim().length} more character${20 - rejectReason.trim().length === 1 ? "" : "s"} required`
                : "Ready to confirm"}
            </p>
            {rejectErr ? <p className="mt-2 text-sm text-error">{rejectErr}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionId === rejectBook.id}
                onClick={closeReject}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-base disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionId === rejectBook.id}
                onClick={submitReject}
                className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-text-primary shadow-sm ring-1 ring-error/35 transition hover:bg-error disabled:pointer-events-none disabled:opacity-50"
              >
                {actionId === rejectBook.id ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
