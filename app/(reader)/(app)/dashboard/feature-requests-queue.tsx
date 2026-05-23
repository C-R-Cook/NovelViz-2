"use client";

import { formatActivityAtUtc } from "@/lib/format-activity-at";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

export type FeatureRequestQueueItem = {
  requestId: string;
  imageId: string;
  createdAtMs: number;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverImageUrl: string | null;
  username: string;
};

function ActivityTimestamp({ ms }: { ms: number }) {
  const text = useMemo(() => formatActivityAtUtc(new Date(ms)), [ms]);
  return <p className="mt-1 text-xs text-text-muted">{text}</p>;
}

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function FeatureRequestsQueue({
  items,
  actionRequestId,
  onDecision,
  className,
}: {
  items: FeatureRequestQueueItem[];
  actionRequestId: string | null;
  onDecision: (requestId: string, action: "approve" | "reject") => void;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="feature-requests-queue-heading"
      className={className ? `${className} space-y-4` : "space-y-4"}
    >
      <div>
        <h2 id="feature-requests-queue-heading" className="text-lg font-semibold text-text-primary">
          Feature requests
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Public images partners want featured on the Discover strip ({items.length} shown).
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No pending feature requests.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => (
            <li
              key={row.requestId}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border/80 bg-bg-base/80 p-4"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary storage URLs */}
                <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
                {row.bookCoverImageUrl ? (
                  <Image src={row.bookCoverImageUrl} alt="" fill className="object-cover" sizes="44px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-text-muted">—</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">{row.bookTitle}</p>
                <p className="text-sm text-text-secondary">{row.bookAuthor}</p>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">{truncate(row.userPrompt, 140)}</p>
                <p className="mt-1 text-xs text-text-muted">
                  Ch. {row.chapterNumberAtTime} · @{row.username}
                </p>
                <ActivityTimestamp ms={row.createdAtMs} />
              </div>
              <div className="dashboard-admin-queue-actions flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionRequestId === row.requestId}
                  className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-success/100 disabled:opacity-50"
                  onClick={() => onDecision(row.requestId, "approve")}
                >
                  {actionRequestId === row.requestId ? "…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={actionRequestId === row.requestId}
                  className="rounded-lg border border-error/40 bg-transparent px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                  onClick={() => onDecision(row.requestId, "reject")}
                >
                  {actionRequestId === row.requestId ? "…" : "Reject"}
                </button>
                <Link
                  href={`/admin/books/${row.bookId}`}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-surface"
                >
                  Book
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
