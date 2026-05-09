"use client";

import { ForReviewQueue } from "@/app/(reader)/(app)/dashboard/for-review-queue";
import { PartnerDashboardBooksClient } from "@/app/(partner)/partner/dashboard/partner-dashboard-books-client";
import { AdminBooksClient } from "@/app/admin/books/admin-books-client";
import { AdminPlatformStatsClient } from "@/components/admin/admin-platform-stats-client";
import { PartnerDashboardAnalytics } from "@/components/partner/partner-dashboard-analytics";
import type { AdminPlatformStatsPayload } from "@/lib/admin-platform-stats";
import type { AdminBookRow } from "@/lib/admin-books-list";
import {
  dashboardTabLabel,
  dashboardTabsForRole,
  defaultDashboardTab,
  parseDashboardTab,
  type DashboardTabSlug,
  type DashboardUserRole,
} from "@/lib/dashboard-tab";
import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  role: DashboardUserRole;
  initialTab: DashboardTabSlug;
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
  adminBooksAll: {
    initialBooks: AdminBookRow[];
    initialHasMore: boolean;
    pageSize: number;
  } | null;
  adminPlatformStats: AdminPlatformStatsPayload | null;
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

function ActivityTimestamp({ ms }: { ms: number }) {
  const [text, setText] = useState("…");

  useEffect(() => {
    setText(formatActivityAtUtc(new Date(ms)));
  }, [ms]);

  return <p className="mt-1 text-xs text-text-muted">{text}</p>;
}

export function DashboardClient({
  role,
  initialTab,
  reader,
  partner,
  admin,
  adminBooksAll,
  adminPlatformStats,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = useMemo(() => dashboardTabsForRole(role), [role]);

  const [tab, setTab] = useState<DashboardTabSlug>(initialTab);
  const [pendingBooks, setPendingBooks] = useState(admin?.pendingBooks ?? []);
  const [actionId, setActionId] = useState<string | null>(null);

  const showTabBar = tabs.length > 1;

  useEffect(() => {
    const raw = searchParams.get("tab");
    const next = parseDashboardTab(role, raw ?? undefined);
    setTab(next);
  }, [searchParams, role]);

  useEffect(() => {
    setPendingBooks(admin?.pendingBooks ?? []);
  }, [admin]);

  function pushTab(next: DashboardTabSlug) {
    const def = defaultDashboardTab(role);
    const params = new URLSearchParams(searchParams.toString());
    if (next === def) params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    const href = q ? `${pathname}?${q}` : pathname ?? "/dashboard";
    router.replace(href, { scroll: false });
    setTab(next);
  }

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

  function readerPanel() {
    return (
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
                    <li key={img.id} className="flex gap-3 rounded-lg border border-border/80 bg-bg-surface p-2">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-border">
                        <Image src={img.imageUrl} alt="" fill className="object-cover" sizes="64px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-muted">{img.bookTitle}</p>
                        <ActivityTimestamp ms={img.createdAtMs} />
                        <Link
                          href="/gallery"
                          className="mt-1 inline-block text-xs font-medium text-accent-text hover:underline"
                        >
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
    );
  }

  function myBooksPanel() {
    if (!partner) return null;
    return (
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
          <span className="font-medium text-text-secondary">{partner.stats.totalBooks}</span> books in your catalogue
        </p>
        <div className="rounded-xl border border-border">
          <PartnerDashboardBooksClient
            initialBooks={partner.initialBooks}
            initialHasMore={partner.initialHasMore}
            pageSize={partner.pageSize}
          />
        </div>
      </div>
    );
  }

  function statsPanel() {
    if (!partner) return null;
    return (
      <div className="space-y-6">
        <PartnerDashboardAnalytics data={partner.analytics} />
      </div>
    );
  }

  function tabContent() {
    switch (tab) {
      case "reader":
        return readerPanel();
      case "my-books":
        return myBooksPanel();
      case "stats":
        return statsPanel();
      case "for-review":
        return admin ? (
          <ForReviewQueue
            pendingBooks={pendingBooks}
            actionId={actionId}
            onModeration={(id, status) => void runModeration(id, status)}
          />
        ) : null;
      case "all-books":
        return adminBooksAll ? (
          <AdminBooksClient
            initialBooks={adminBooksAll.initialBooks}
            initialFilter="all"
            initialHasMore={adminBooksAll.initialHasMore}
            pageSize={adminBooksAll.pageSize}
            initialSort="createdAt"
            initialSortDir="desc"
            variant="embedded"
          />
        ) : null;
      case "admin-stats":
        if (!adminPlatformStats || !admin) return null;
        return (
          <div className="space-y-10">
            <section aria-labelledby="dashboard-admin-quick-stats">
              <h2 id="dashboard-admin-quick-stats" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Quick stats
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatMini label="Total users" value={admin.totalUsers} />
                <StatMini label="Total books" value={admin.totalBooks} />
                <StatMini label="Pending review" value={admin.pendingReviewCount} />
              </div>
            </section>

            <section aria-labelledby="dashboard-admin-book-requests" className="rounded-xl border border-border bg-bg-base/50 p-5">
              <h2 id="dashboard-admin-book-requests" className="text-lg font-semibold text-text-primary">
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
            </section>

            <AdminPlatformStatsClient data={adminPlatformStats} />
          </div>
        );
      default:
        return readerPanel();
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Dashboard</h1>

      {!showTabBar ? (
        <div className="mt-8">{readerPanel()}</div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Dashboard sections">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}
                data-active-tab={tab === t ? "true" : undefined}
                onClick={() => pushTab(t)}
              >
                {dashboardTabLabel(t)}
              </button>
            ))}
          </div>

          <div className="rounded-b-xl rounded-tr-xl border border-border border-t-0 bg-bg-surface/90 p-6 shadow-sm">
            {tabContent()}
          </div>
        </>
      )}
    </div>
  );
}
