"use client";

import { PartnerDashboardBooksClient } from "@/app/(partner)/partner/dashboard/partner-dashboard-books-client";
import { PartnerDashboardAnalytics } from "@/components/partner/partner-dashboard-analytics";
import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DashboardRole = "reader" | "partner" | "admin";

const REJECT_REASON =
  "This book has been rejected during admin moderation review. The publisher may revise and resubmit after addressing the feedback provided.";

const tabBase =
  "rounded-t-lg border border-b-0 border-transparent px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const tabInactive = "border-transparent text-text-muted hover:text-text-primary";
const tabActive =
  "border-accent/80 border-border bg-bg-surface text-accent-text";

const card =
  "rounded-xl border border-border bg-bg-surface/90 p-4 shadow-sm";

export type DashboardClientProps = {
  role: DashboardRole;
  reader: {
    displayName: string;
    email: string;
    stats: { libraryBookCount: number; queryCount: number; generatedImageCount: number };
    currentlyReading: {
      bookId: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      currentChapterNumber: number;
      chapterTitle: string | null;
    }[];
    recentQueries: { id: string; questionText: string; bookTitle: string; createdAtMs: number }[];
    recentImages: { id: string; imageUrl: string; bookTitle: string; createdAtMs: number }[];
  };
  partner: {
    stats: { totalBooks: number; totalReaders: number; totalQueries: number; totalImages: number };
    analytics: PartnerAnalyticsPayload;
    initialBooks: PartnerDashboardBookRow[];
    initialHasMore: boolean;
    pageSize: number;
  } | null;
  admin: {
    pendingBooks: { id: string; title: string; author: string; coverImageUrl: string | null }[];
    totalUsers: number;
    totalBooks: number;
    pendingReviewCount: number;
    bookRequests: { totalCount: number; topBooks: { bookTitle: string; count: number }[] };
  } | null;
};

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className={card}>
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Renders a stable placeholder on SSR + first client paint, then UTC text after mount (avoids hydration mismatches). */
function ActivityTimestamp({ ms }: { ms: number }) {
  const [text, setText] = useState("…");

  useEffect(() => {
    setText(formatActivityAtUtc(new Date(ms)));
  }, [ms]);

  return <p className="mt-1 text-xs text-text-muted">{text}</p>;
}

export function DashboardClient({ role, reader, partner, admin }: DashboardClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"reader" | "partner" | "admin">("reader");

  const showPartnerTab = role === "partner" || role === "admin";
  const showAdminTab = role === "admin";

  useEffect(() => {
    if (tab === "partner" && !showPartnerTab) setTab("reader");
    if (tab === "admin" && !showAdminTab) setTab("reader");
  }, [tab, showPartnerTab, showAdminTab]);

  const [pendingBooks, setPendingBooks] = useState(admin?.pendingBooks ?? []);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    setPendingBooks(admin?.pendingBooks ?? []);
  }, [admin]);

  const runModeration = useCallback(
    async (bookId: string, status: "published" | "rejected") => {
      setActionId(bookId);
      try {
        const body =
          status === "rejected"
            ? { status: "rejected" as const, rejectionReason: REJECT_REASON }
            : { status: "published" as const };
        const res = await fetch(`/api/admin/books/${bookId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          window.alert(j.error ?? "Update failed");
          return;
        }
        setPendingBooks((prev) => prev.filter((b) => b.id !== bookId));
        router.refresh();
      } finally {
        setActionId(null);
      }
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
        Dashboard
      </h1>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        <button type="button" className={`${tabBase} ${tab === "reader" ? tabActive : tabInactive}`} onClick={() => setTab("reader")}>
          Reader
        </button>
        {showPartnerTab ? (
          <button
            type="button"
            className={`${tabBase} ${tab === "partner" ? tabActive : tabInactive}`}
            onClick={() => setTab("partner")}
          >
            Partner
          </button>
        ) : null}
        {showAdminTab ? (
          <button type="button" className={`${tabBase} ${tab === "admin" ? tabActive : tabInactive}`} onClick={() => setTab("admin")}>
            Admin
          </button>
        ) : null}
      </div>

      <div className="rounded-b-xl rounded-tr-xl border border-border border-t-0 bg-bg-surface/90 p-6 shadow-sm">
        {tab === "reader" ? (
          <div className="space-y-10">
            <div>
              <p className="text-lg text-text-primary">
                Welcome back, <span className="font-semibold text-accent-text">{reader.displayName}</span>
              </p>
              <p className="mt-1 text-sm text-text-secondary">{reader.email}</p>
              <Link
                href="/library"
                className="mt-4 inline-flex text-sm font-medium text-accent-text underline-offset-2 hover:underline"
              >
                Open My Library →
              </Link>
            </div>

            <section aria-labelledby="reader-stats">
              <h2 id="reader-stats" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Reading stats
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatMini label="Books in library" value={reader.stats.libraryBookCount} />
                <StatMini label="Questions asked" value={reader.stats.queryCount} />
                <StatMini label="Images generated" value={reader.stats.generatedImageCount} />
              </div>
            </section>

            <section aria-labelledby="reader-continue">
              <h2 id="reader-continue" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Currently reading
              </h2>
              {reader.currentlyReading.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No books in progress. Add a book from Discover and open it to start reading.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {reader.currentlyReading.map((b) => (
                    <li
                      key={b.bookId}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-border/80 bg-bg-base/80 p-4"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
                        {b.coverImageUrl ? (
                          <Image src={b.coverImageUrl} alt="" fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-text-muted">—</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary">{b.title}</p>
                        <p className="text-sm text-text-secondary">{b.author}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          Chapter {b.currentChapterNumber}
                          {b.chapterTitle ? `: ${b.chapterTitle}` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/reader/${b.bookId}`}
                        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent"
                      >
                        Continue reading
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="reader-activity">
              <h2 id="reader-activity" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Recent activity
                <span className="ml-2 font-normal normal-case text-text-secondary">(UTC)</span>
              </h2>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-text-secondary">Last questions</h3>
                  {reader.recentQueries.length === 0 ? (
                    <p className="mt-2 text-sm text-text-muted">No questions yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {reader.recentQueries.map((q) => (
                        <li key={q.id} className="rounded-lg border border-border/80 bg-bg-surface px-3 py-2 text-sm">
                          <p className="text-xs text-text-muted">{q.bookTitle}</p>
                          <p className="mt-1 text-text-primary">{truncate(q.questionText, 160)}</p>
                          <ActivityTimestamp ms={q.createdAtMs} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-text-secondary">Last images</h3>
                  {reader.recentImages.length === 0 ? (
                    <p className="mt-2 text-sm text-text-muted">No images yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {reader.recentImages.map((img) => (
                        <li
                          key={img.id}
                          className="flex gap-3 rounded-lg border border-border/80 bg-bg-surface p-2"
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-border">
                            <Image src={img.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-muted">{img.bookTitle}</p>
                            <ActivityTimestamp ms={img.createdAtMs} />
                            <Link href="/gallery" className="mt-1 inline-block text-xs font-medium text-accent-text hover:underline">
                              View in gallery
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "partner" && partner ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Your books</h2>
                <p className="mt-1 text-sm text-text-secondary">Manage drafts, ingestion, and publishing.</p>
              </div>
              <Link
                href="/partner/books/new"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent"
              >
                Upload new book
              </Link>
            </div>
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">{partner.stats.totalBooks}</span> books
              in your catalogue
            </p>
            <PartnerDashboardAnalytics data={partner.analytics} />
            <div className="rounded-xl border border-border">
              <PartnerDashboardBooksClient
                initialBooks={partner.initialBooks}
                initialHasMore={partner.initialHasMore}
                pageSize={partner.pageSize}
              />
            </div>
          </div>
        ) : null}

        {tab === "admin" && admin ? (
          <div className="space-y-8">
            <section aria-labelledby="admin-stats">
              <h2 id="admin-stats" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Quick stats
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatMini label="Total users" value={admin.totalUsers} />
                <StatMini label="Total books" value={admin.totalBooks} />
                <StatMini label="Pending review" value={admin.pendingReviewCount} />
              </div>
            </section>

            <section className="flex flex-wrap gap-3" aria-label="Admin shortcuts">
              <Link
                href="/admin/books"
                className="rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-raised"
              >
                Manage all books
              </Link>
              <Link
                href="/admin/stats"
                className="rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-raised"
              >
                View statistics
              </Link>
            </section>

            <section aria-labelledby="admin-book-requests" className="rounded-xl border border-border bg-bg-base/50 p-5">
              <h2 id="admin-book-requests" className="text-lg font-semibold text-text-primary">
                Book requests
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Total requests recorded:{" "}
                <span className="font-semibold text-text-primary">{admin.bookRequests.totalCount}</span>
              </p>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Top requested titles</h3>
              {admin.bookRequests.topBooks.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No book requests yet.</p>
              ) : (
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-text-primary">
                  {admin.bookRequests.topBooks.map((row) => (
                    <li key={row.bookTitle}>
                      <span className="font-medium">{row.bookTitle}</span>{" "}
                      <span className="text-text-muted">({row.count} requests)</span>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href="/admin/requests"
                className="mt-4 inline-flex text-sm font-medium text-accent-text underline-offset-2 hover:underline"
              >
                View all book requests →
              </Link>
            </section>

            <section aria-labelledby="admin-queue">
              <h2 id="admin-queue" className="text-lg font-semibold text-text-primary">
                Moderation queue
              </h2>
              <p className="mt-1 text-sm text-text-secondary">Books awaiting review ({pendingBooks.length} shown).</p>
              {pendingBooks.length === 0 ? (
                <p className="mt-4 text-sm text-text-muted">No books are pending review.</p>
              ) : (
                <ul className="mt-4 space-y-4">
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
                          onClick={() => void runModeration(book.id, "published")}
                        >
                          {actionId === book.id ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === book.id}
                          className="rounded-lg border border-error/40 bg-transparent px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/10 disabled:opacity-50"
                          onClick={() => void runModeration(book.id, "rejected")}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
