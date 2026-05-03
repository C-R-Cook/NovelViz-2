"use client";

import { PartnerDashboardBooksClient } from "@/app/(partner)/partner/dashboard/partner-dashboard-books-client";
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
  "rounded-t-lg border border-b-0 border-transparent px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40";
const tabInactive = "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";
const tabActive =
  "border-amber-500/80 border-zinc-200 bg-white text-amber-900 dark:border-amber-400/60 dark:border-b-zinc-950 dark:bg-zinc-950 dark:text-amber-100";

const card =
  "rounded-xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40";

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
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
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

  return <p className="mt-1 text-xs text-zinc-500">{text}</p>;
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
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Reader tools, partner publishing, and admin moderation in one place.
      </p>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
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

      <div className="rounded-b-xl rounded-tr-xl border border-zinc-200/90 border-t-0 bg-white/90 p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:shadow-none">
        {tab === "reader" ? (
          <div className="space-y-10">
            <div>
              <p className="text-lg text-zinc-800 dark:text-zinc-100">
                Welcome back, <span className="font-semibold text-amber-800 dark:text-amber-200/90">{reader.displayName}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{reader.email}</p>
              <Link
                href="/library"
                className="mt-4 inline-flex text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300/90"
              >
                Open My Library →
              </Link>
            </div>

            <section aria-labelledby="reader-stats">
              <h2 id="reader-stats" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Reading stats
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatMini label="Books in library" value={reader.stats.libraryBookCount} />
                <StatMini label="Questions asked" value={reader.stats.queryCount} />
                <StatMini label="Images generated" value={reader.stats.generatedImageCount} />
              </div>
            </section>

            <section aria-labelledby="reader-continue">
              <h2 id="reader-continue" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Currently reading
              </h2>
              {reader.currentlyReading.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  No books in progress. Add a book from Discover and open it to start reading.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {reader.currentlyReading.map((b) => (
                    <li
                      key={b.bookId}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
                        {b.coverImageUrl ? (
                          <Image src={b.coverImageUrl} alt="" fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-zinc-500">—</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{b.title}</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{b.author}</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          Chapter {b.currentChapterNumber}
                          {b.chapterTitle ? `: ${b.chapterTitle}` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/reader/${b.bookId}`}
                        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
                      >
                        Continue reading
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="reader-activity">
              <h2 id="reader-activity" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                Recent activity
                <span className="ml-2 font-normal normal-case text-zinc-400 dark:text-zinc-600">(UTC)</span>
              </h2>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Last questions</h3>
                  {reader.recentQueries.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No questions yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {reader.recentQueries.map((q) => (
                        <li key={q.id} className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                          <p className="text-xs text-zinc-500">{q.bookTitle}</p>
                          <p className="mt-1 text-zinc-800 dark:text-zinc-200">{truncate(q.questionText, 160)}</p>
                          <ActivityTimestamp ms={q.createdAtMs} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Last images</h3>
                  {reader.recentImages.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No images yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {reader.recentImages.map((img) => (
                        <li
                          key={img.id}
                          className="flex gap-3 rounded-lg border border-zinc-200/80 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/40"
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
                            <Image src={img.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-500">{img.bookTitle}</p>
                            <ActivityTimestamp ms={img.createdAtMs} />
                            <Link href="/gallery" className="mt-1 inline-block text-xs font-medium text-amber-800 hover:underline dark:text-amber-300/90">
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
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your books</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Manage drafts, ingestion, and publishing.</p>
              </div>
              <Link
                href="/partner/books/new"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
              >
                Upload new book
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatMini label="Total books" value={partner.stats.totalBooks} />
              <StatMini label="Total readers" value={partner.stats.totalReaders} />
              <StatMini label="Total queries" value={partner.stats.totalQueries} />
              <StatMini label="Total images" value={partner.stats.totalImages} />
            </div>
            <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800/80">
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
              <h2 id="admin-stats" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
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
                className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Manage all books
              </Link>
              <Link
                href="/admin/stats"
                className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                View statistics
              </Link>
            </section>

            <section aria-labelledby="admin-book-requests" className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
              <h2 id="admin-book-requests" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Book requests
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Total requests recorded:{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{admin.bookRequests.totalCount}</span>
              </p>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Top requested titles</h3>
              {admin.bookRequests.topBooks.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No book requests yet.</p>
              ) : (
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                  {admin.bookRequests.topBooks.map((row) => (
                    <li key={row.bookTitle}>
                      <span className="font-medium">{row.bookTitle}</span>{" "}
                      <span className="text-zinc-500 dark:text-zinc-400">({row.count} requests)</span>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href="/admin/requests"
                className="mt-4 inline-flex text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300/90"
              >
                View all book requests →
              </Link>
            </section>

            <section aria-labelledby="admin-queue">
              <h2 id="admin-queue" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Moderation queue
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Books awaiting review ({pendingBooks.length} shown).</p>
              {pendingBooks.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No books are pending review.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {pendingBooks.map((book) => (
                    <li
                      key={book.id}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
                        {book.coverImageUrl ? (
                          <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="44px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-500">—</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{book.title}</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{book.author}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionId === book.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          onClick={() => void runModeration(book.id, "published")}
                        >
                          {actionId === book.id ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === book.id}
                          className="rounded-lg border border-red-600/80 bg-transparent px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                          onClick={() => void runModeration(book.id, "rejected")}
                        >
                          Reject
                        </button>
                        <Link
                          href={`/admin/books/${book.id}`}
                          className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
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
