"use client";

import type { ListingPreferenceAfterReview } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type ForReviewBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
};

export function ForReviewQueue({
  pendingBooks,
  actionId,
  onModeration,
}: {
  pendingBooks: ForReviewBook[];
  actionId: string | null;
  onModeration: (
    bookId: string,
    payload: { status: "published" | "unlisted" | "rejected"; rejectionReason?: string },
  ) => void;
}) {
  const [rejectBook, setRejectBook] = useState<ForReviewBook | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectErr, setRejectErr] = useState<string | null>(null);

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
    closeReject();
  }

  return (
    <>
      <section aria-labelledby="for-review-queue-heading" className="space-y-4">
        <div>
          <h2 id="for-review-queue-heading" className="text-lg font-semibold text-text-primary">
            For review
          </h2>
          <p className="mt-1 text-sm text-text-secondary">Books awaiting moderation ({pendingBooks.length} shown).</p>
        </div>
        {pendingBooks.length === 0 ? (
          <p className="text-sm text-text-muted">No books are pending review.</p>
        ) : (
          <ul className="space-y-4">
            {pendingBooks.map((book) => (
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
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionId === book.id}
                    className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-success/100 disabled:opacity-50"
                    onClick={() =>
                      onModeration(book.id, {
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
                    href={`/admin/books/${book.id}`}
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
