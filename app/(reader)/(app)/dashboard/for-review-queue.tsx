"use client";

import Image from "next/image";
import Link from "next/link";

export type ForReviewBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
};

export function ForReviewQueue({
  pendingBooks,
  actionId,
  onModeration,
}: {
  pendingBooks: ForReviewBook[];
  actionId: string | null;
  onModeration: (bookId: string, status: "published" | "rejected") => void;
}) {
  return (
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
                  onClick={() => onModeration(book.id, "published")}
                >
                  {actionId === book.id ? "…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={actionId === book.id}
                  className="rounded-lg border border-error/40 bg-transparent px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                  onClick={() => onModeration(book.id, "rejected")}
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
  );
}
