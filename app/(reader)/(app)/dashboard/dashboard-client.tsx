"use client";

import { AccountPageClient, type AccountPageClientProps } from "@/app/(reader)/(app)/account/account-client";
import { DashboardPartnerSection } from "@/app/(reader)/(app)/dashboard/dashboard-partner-section";
import { FeatureRequestsQueue } from "@/app/(reader)/(app)/dashboard/feature-requests-queue";
import {
  ForReviewQueue,
  toForReviewBook,
} from "@/app/(reader)/(app)/dashboard/for-review-queue";
import { FOR_REVIEW_QUEUE_PAGE_SIZE, type AdminBookRow } from "@/lib/admin-books-shared";
import { FlaggedCommentsQueue } from "@/app/(reader)/(app)/dashboard/flagged-comments-queue";
import { SpoilerCommentsQueue } from "@/app/(reader)/(app)/dashboard/spoiler-comments-queue";
import type { AdminFlaggedCommentRow } from "@/lib/admin-flagged-comments-queue";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import { PartnerDashboardBooksClient } from "@/app/(partner)/partner/dashboard/partner-dashboard-books-client";
import { AdminBooksClient } from "@/app/admin/books/admin-books-client";
import { UsersAdminClient } from "@/app/admin/users/users-client";
import { AdminHelpersNav } from "@/components/admin/admin-helpers-nav";
import { AdminStatsClient } from "@/components/admin/admin-stats-client";
import { gutenbergNavLinkIsActive } from "@/lib/gutenberg-admin-nav";
import { DiscoverParticleField } from "@/components/discover-particle-field";
import { PartnerDashboardAnalytics } from "@/components/partner/partner-dashboard-analytics";
import type { AdminStatsPayload } from "@/lib/admin-stats";
import {
  dashboardNavForRole,
  dashboardPageTitle,
  dashboardTabLabel,
  defaultDashboardTab,
  parseDashboardTab,
  type DashboardNavBadge,
  type DashboardNavEntry,
  type DashboardTabSlug,
  type DashboardUserRole,
} from "@/lib/dashboard-tab";
import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import "./dashboard-redesign.css";

const REJECT_REASON =
  "This book has been rejected during admin moderation review. The publisher may revise and resubmit after addressing the feedback provided.";

export type DashboardClientProps = {
  role: DashboardUserRole;
  roleDisplayLabel: string;
  reader: {
    displayName: string;
    username: string | null;
    email: string;
    stats: { libraryBookCount: number; queryCount: number; generatedImageCount: number };
    currentlyReading: {
      bookId: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      currentChapterNumber: number;
      chapterTitle: string | null;
      genreLabel: string;
      chapterCount: number;
      queryCount: number;
      imageCount: number;
      progressPercent: number;
    }[];
    recentQueries: {
      id: string;
      questionText: string;
      bookTitle: string;
      chapterNumberAtTime: number;
      createdAtMs: number;
    }[];
    recentImages: {
      id: string;
      imageUrl: string;
      bookTitle: string;
      chapterNumberAtTime: number;
      userPrompt: string;
      isPublic: boolean;
      createdAtMs: number;
    }[];
  };
  partner: {
    stats: { totalBooks: number; totalReaders: number; totalQueries: number; totalImages: number };
    analytics: PartnerAnalyticsPayload;
    initialBooks: PartnerDashboardBookRow[];
    initialHasMore: boolean;
    pageSize: number;
    ownFeatureRequests: {
      id: string;
      status: string;
      createdAtMs: number;
      bookTitle: string;
      chapterNumberAtTime: number;
      userPrompt: string;
      imageUrl: string;
    }[];
    ownFeatureRequestsPendingCount: number;
  } | null;
  admin: {
    pendingBooks: {
      id: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      listingPreferenceAfterReview: "published" | "unlisted" | null;
    }[];
    totalUsers: number;
    totalBooks: number;
    liveBooksCount: number;
    pendingReviewCount: number;
    bookRequests: { totalCount: number; topBooks: { bookTitle: string; count: number }[] };
    featureRequestsQueue: {
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
    }[];
    featureRequestsPendingCount: number;
    spoilerCommentsQueue: AdminSpoilerCommentRow[];
    spoilerCommentsPendingCount: number;
    flaggedCommentsQueue: AdminFlaggedCommentRow[];
    flaggedCommentsPendingCount: number;
  } | null;
  adminBooksAll: {
    initialBooks: AdminBookRow[];
    initialHasMore: boolean;
    pageSize: number;
  } | null;
  adminStats: AdminStatsPayload | null;
  account: Pick<
    AccountPageClientProps,
    "viewerId" | "user" | "stats" | "memberSinceLabel" | "isProduction"
  >;
};

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function ActivityTimestamp({ ms }: { ms: number }) {
  const text = useMemo(() => formatActivityAtUtc(new Date(ms)), [ms]);
  return <span className="font-mono text-[8px] tracking-wide text-text-muted">{text}</span>;
}

function navBadgeValue(
  badge: DashboardNavBadge | undefined,
  admin: DashboardClientProps["admin"],
  partner: DashboardClientProps["partner"],
): number {
  if (!badge) return 0;
  if (badge === "forReview") return admin?.pendingReviewCount ?? 0;
  if (badge === "featureApprovals") return admin?.featureRequestsPendingCount ?? 0;
  if (badge === "spoilerComments") return admin?.spoilerCommentsPendingCount ?? 0;
  if (badge === "flaggedComments") return admin?.flaggedCommentsPendingCount ?? 0;
  if (badge === "partnerFeatReq") return partner?.ownFeatureRequestsPendingCount ?? 0;
  return 0;
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <div className="dashboard-slabel-row">
      <span className="dashboard-slabel">{label}</span>
      <span className="dashboard-slabel-line" aria-hidden />
      {right ? <span className="dashboard-slabel-right">{right}</span> : null}
    </div>
  );
}

function GemDivider() {
  return (
    <div className="dashboard-section-divider" aria-hidden>
      <span className="dashboard-divider-line" />
      <span className="dashboard-divider-gem">✦</span>
      <span className="dashboard-divider-line" />
    </div>
  );
}

function ProgressArc({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="color-mix(in srgb, var(--text-primary) 8%, transparent)"
        strokeWidth={2.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function KpiCard({ label, value, sub, delayMs = 0 }: { label: string; value: string | number; sub?: string; delayMs?: number }) {
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

export function DashboardClient({
  role,
  roleDisplayLabel,
  reader,
  partner,
  admin,
  adminBooksAll,
  adminStats,
  account,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navEntries = useMemo(() => dashboardNavForRole(role), [role]);
  const reducedMotion = useReducedMotion();

  const tab = useMemo(
    () => parseDashboardTab(role, searchParams.get("tab") ?? undefined),
    [role, searchParams],
  );

  const [pendingBooks, setPendingBooks] = useState(admin?.pendingBooks ?? []);
  const [loadingMorePending, setLoadingMorePending] = useState(false);
  const [loadMorePendingErr, setLoadMorePendingErr] = useState<string | null>(null);
  const [featureRequestQueue, setFeatureRequestQueue] = useState(admin?.featureRequestsQueue ?? []);
  const [actionId, setActionId] = useState<string | null>(null);
  const [featureActionId, setFeatureActionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const server = admin?.pendingBooks ?? [];
    queueMicrotask(() => {
      setPendingBooks((prev) => {
        if (prev.length === 0) return server;
        // Keep extra pages loaded via "Load next 50" after refresh (delete/moderate).
        if (prev.length > server.length) return prev;
        return server;
      });
    });
  }, [admin]);

  useEffect(() => {
    queueMicrotask(() => {
      setFeatureRequestQueue(admin?.featureRequestsQueue ?? []);
    });
  }, [admin]);

  useEffect(() => {
    closeSidebar();
  }, [tab, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) closeSidebar();
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  function pushTab(next: DashboardTabSlug) {
    const def = defaultDashboardTab(role);
    const params = new URLSearchParams(searchParams.toString());
    if (next === def) params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    const href = q ? `${pathname}?${q}` : pathname ?? "/dashboard";
    router.replace(href, { scroll: false });
  }

  const runModeration = useCallback(
    async (
      bookId: string,
      payload: { status: "published" | "unlisted" | "rejected"; rejectionReason?: string },
    ) => {
      setActionId(bookId);
      try {
        const body =
          payload.status === "rejected"
            ? {
                status: "rejected" as const,
                rejectionReason: payload.rejectionReason?.trim() || REJECT_REASON,
              }
            : { status: payload.status };
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

  const handleForReviewBookDeleted = useCallback(
    (bookId: string) => {
      setPendingBooks((prev) => prev.filter((b) => b.id !== bookId));
      router.refresh();
    },
    [router],
  );

  const loadMorePendingBooks = useCallback(async () => {
    if (!admin) return;
    setLoadingMorePending(true);
    setLoadMorePendingErr(null);
    try {
      const params = new URLSearchParams({
        filter: "pending_review",
        skip: String(pendingBooks.length),
        take: String(FOR_REVIEW_QUEUE_PAGE_SIZE),
        sort: "updatedAt",
        dir: "desc",
      });
      const res = await fetch(`/api/admin/books?${params.toString()}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const data = (await res.json()) as { books?: AdminBookRow[] };
      const next = Array.isArray(data.books) ? data.books.map(toForReviewBook) : [];
      if (next.length === 0) return;
      setPendingBooks((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const merged = [...prev];
        for (const book of next) {
          if (!seen.has(book.id)) {
            seen.add(book.id);
            merged.push(book);
          }
        }
        return merged;
      });
    } catch (err) {
      setLoadMorePendingErr(err instanceof Error ? err.message : "Could not load more books");
    } finally {
      setLoadingMorePending(false);
    }
  }, [admin, pendingBooks.length]);

  const hasMorePendingBooks =
    admin != null && pendingBooks.length < admin.pendingReviewCount;

  const runFeatureRequestDecision = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setFeatureActionId(requestId);
      try {
        const res = await fetch(`/api/feature-requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          window.alert(j.error ?? "Update failed");
          return;
        }
        setFeatureRequestQueue((prev) => prev.filter((r) => r.requestId !== requestId));
        router.refresh();
      } finally {
        setFeatureActionId(null);
      }
    },
    [router],
  );

  function renderNavRow(entry: DashboardNavEntry) {
    if (entry.kind === "divider") {
      return <div key={entry.id} className="dashboard-nav-divider" />;
    }
    if (entry.kind === "group-label") {
      return <div key={entry.id} className="dashboard-nav-group-label">{entry.label}</div>;
    }
    if (entry.kind === "helpers") {
      return <AdminHelpersNav key={entry.id} variant="sidebar" onNavigate={closeSidebar} />;
    }
    if (entry.kind === "link") {
      const active =
        entry.href.startsWith("/admin/gutenberg") || entry.href.startsWith("/admin/books")
          ? gutenbergNavLinkIsActive(pathname ?? "", searchParams.get("tab"), entry.href)
          : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
      return (
        <Link
          key={entry.id}
          href={entry.href}
          className="dashboard-nav-btn no-underline"
          data-active={active ? "true" : "false"}
          onClick={closeSidebar}
        >
          <span className="dashboard-nav-icon" aria-hidden>
            {entry.icon}
          </span>
          <span className="dashboard-nav-label">{entry.label}</span>
        </Link>
      );
    }
    const { tab: slug, icon, badge } = entry;
    const n = navBadgeValue(badge, admin, partner);
    return (
      <button
        key={slug}
        type="button"
        className="dashboard-nav-btn"
        data-active={tab === slug ? "true" : "false"}
        onClick={() => {
          pushTab(slug);
          closeSidebar();
        }}
      >
        <span className="dashboard-nav-icon" aria-hidden>
          {icon}
        </span>
        <span className="dashboard-nav-label">{dashboardTabLabel(slug)}</span>
        {badge && n > 0 ? <span className="dashboard-nav-badge">{n > 99 ? "99+" : n}</span> : null}
      </button>
    );
  }

  function SidebarToggleIcon({ open }: { open: boolean }) {
    if (open) {
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  }

  function bookRow(b: (typeof reader.currentlyReading)[0], i: number, opts?: { staggerClass?: string }) {
    const delay = reducedMotion ? 0 : i * 75;
    const chTotal = Math.max(1, b.chapterCount);
    const pctBar = Math.round((b.currentChapterNumber / chTotal) * 100);
    return (
      <Link
        key={b.bookId}
        href={`/library?book=${b.bookId}`}
        className={`dashboard-book-row ${opts?.staggerClass ?? "dashboard-stagger-item"} block no-underline`}
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      >
        <div className="relative h-14 w-[42px] shrink-0 overflow-hidden rounded border border-border-subtle bg-bg-surface">
          {b.coverImageUrl ? (
            <Image src={b.coverImageUrl} alt="" fill className="object-cover brightness-[0.92]" sizes="42px" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-text-muted">—</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="dashboard-book-genre">{b.genreLabel}</div>
          <div className="dashboard-book-title">{b.title}</div>
          <div className="dashboard-book-author">by {b.author}</div>
          <div className="dashboard-book-progress-track">
            <div className="dashboard-book-progress-fill" style={{ width: `${Math.min(100, pctBar)}%` }} />
          </div>
          <div className="dashboard-book-meta-row">
            <span>
              CH. {b.currentChapterNumber} / {chTotal}
            </span>
            <span className="text-accent/90">{b.progressPercent}%</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="relative flex items-center justify-center">
            <ProgressArc pct={b.progressPercent} />
            <span className="pointer-events-none absolute font-mono text-[8px] text-accent/80">{b.progressPercent}%</span>
          </div>
          <div className="flex gap-2.5">
            <div className="text-center">
              <div className="font-mono text-[11px] text-accent/90">{b.queryCount}</div>
              <div className="font-mono text-[7px] tracking-wide text-text-muted">Q&A</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[11px] text-accent/90">{b.imageCount}</div>
              <div className="font-mono text-[7px] tracking-wide text-text-muted">IMG</div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  function overviewSection() {
    const first = reader.currentlyReading[0];

    // Collect actionable admin queue items with non-zero counts
    const actionItems: { count: number; label: string; tab: DashboardTabSlug; icon: string }[] = admin
      ? [
          { count: admin.pendingReviewCount, label: "For Review", tab: "for-review" as const, icon: "✅" },
          { count: admin.featureRequestsPendingCount, label: "Feature Approvals", tab: "feature-approvals" as const, icon: "⭐" },
          { count: admin.spoilerCommentsPendingCount, label: "Spoiler Comments", tab: "spoiler-comments" as const, icon: "⚠️" },
          { count: admin.flaggedCommentsPendingCount, label: "Flagged Comments", tab: "flagged-comments" as const, icon: "🚩" },
        ].filter((item) => item.count > 0)
      : [];

    return (
      <div>
        {/* Reader activity KPIs — 3 cards for reader/partner, 4 for admin (includes pending reviews) */}
        <div
          className={
            role === "admin" && admin
              ? "dashboard-kpi-grid dashboard-kpi-grid--3plus1"
              : "dashboard-kpi-grid dashboard-kpi-grid--3"
          }
        >
          <KpiCard label="Books in library" value={reader.stats.libraryBookCount} sub="Active in your library" delayMs={reducedMotion ? 0 : 80} />
          <KpiCard label="Q&A sessions" value={reader.stats.queryCount} sub="Questions asked" delayMs={reducedMotion ? 0 : 140} />
          <KpiCard label="Images created" value={reader.stats.generatedImageCount} sub="Across all books" delayMs={reducedMotion ? 0 : 200} />
          {role === "admin" && admin ? (
            <KpiCard
              label="Pending reviews"
              value={admin.pendingReviewCount}
              sub="Books in queue"
              delayMs={reducedMotion ? 0 : 260}
            />
          ) : null}
        </div>

        {/* Publisher snapshot — compact 4-stat row for partners and admins */}
        {partner ? (
          <div className="dashboard-kpi-grid dashboard-kpi-grid--4 mt-4">
            <KpiCard label="Your books" value={partner.stats.totalBooks} sub="In catalogue" delayMs={reducedMotion ? 0 : 80} />
            <KpiCard label="Readers" value={partner.stats.totalReaders} sub="Across all titles" delayMs={reducedMotion ? 0 : 120} />
            <KpiCard label="Q&A queries" value={partner.stats.totalQueries} sub="On your books" delayMs={reducedMotion ? 0 : 160} />
            <KpiCard label="Images generated" value={partner.stats.totalImages} sub="By readers" delayMs={reducedMotion ? 0 : 200} />
          </div>
        ) : null}

        {/* Pending action items — admin only, only shown when there are items to act on */}
        {actionItems.length > 0 ? (
          <div className="dashboard-action-items">
            <SectionLabel
              label="Pending action items"
              right={`${actionItems.reduce((s, item) => s + item.count, 0)} total`}
            />
            <div className="dashboard-action-pills">
              {actionItems.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  className="dashboard-action-pill"
                  onClick={() => pushTab(item.tab)}
                >
                  <span className="dashboard-action-pill-icon" aria-hidden>{item.icon}</span>
                  <span className="dashboard-action-pill-count">{item.count}</span>
                  <span className="dashboard-action-pill-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {first ? (
          <div className="dashboard-cta-band">
            {!reducedMotion ? <DiscoverParticleField /> : null}
            <div className="dashboard-cta-band-inner min-w-0">
              <div className="dashboard-cta-eyebrow">Continue reading</div>
              <div className="dashboard-cta-title">
                You&apos;re on Chapter {first.currentChapterNumber} of {first.title}.
              </div>
              <div className="dashboard-cta-sub">
                {Math.max(0, first.chapterCount - first.currentChapterNumber)} chapters remaining — your AI companion is ready.
              </div>
            </div>
            <div className="dashboard-cta-actions">
              <Link
                href={`/library?book=${first.bookId}`}
                className="rounded border border-accent bg-accent px-5 py-2 font-mono text-[8px] font-bold uppercase tracking-widest text-text-primary transition hover:opacity-95"
              >
                Open reader →
              </Link>
              <Link
                href={`/library?book=${first.bookId}`}
                className="rounded border border-border-subtle px-4 py-2 font-mono text-[8px] uppercase tracking-widest text-text-muted transition hover:border-accent/40 hover:text-text-secondary"
              >
                Ask question
              </Link>
            </div>
          </div>
        ) : null}

        <SectionLabel label="Currently reading" right={`${reader.currentlyReading.length} books`} />
        <div className="flex flex-col gap-2">
          {reader.currentlyReading.length === 0 ? (
            <p className="text-sm text-text-secondary">No books in progress. Add a book from Discover and open it to start reading.</p>
          ) : (
            reader.currentlyReading.map((b, i) => bookRow(b, i))
          )}
        </div>
      </div>
    );
  }

  function readingSection() {
    return (
      <div>
        <SectionLabel label="In progress" right={`${reader.currentlyReading.length} books`} />
        <div className="flex flex-col gap-2">
          {reader.currentlyReading.length === 0 ? (
            <p className="text-sm text-text-secondary">No books in progress.</p>
          ) : (
            reader.currentlyReading.map((b, i) => bookRow(b, i))
          )}
        </div>
      </div>
    );
  }

  function imagesSection() {
    return (
      <div>
        <SectionLabel label="Recent images" right={`${reader.recentImages.length} shown`} />
        {reader.recentImages.length === 0 ? (
          <p className="text-sm text-text-secondary">No images yet.</p>
        ) : (
          <div className="dashboard-image-strip">
            {reader.recentImages.map((img, i) => {
              const delay = reducedMotion ? 0 : i * 65;
              return (
                <Link
                  key={img.id}
                  href="/gallery"
                  className="dashboard-image-thumb dashboard-stagger-item block overflow-hidden"
                  style={delay ? { animationDelay: `${delay}ms` } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs */}
                  <img src={img.imageUrl} alt="" className="dashboard-image-thumb-img" />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"
                    aria-hidden
                  />
                  <span
                    className={`pointer-events-none absolute right-1.5 top-1.5 rounded-full border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wide ${
                      img.isPublic
                        ? "border-success/45 bg-success/20 text-success"
                        : "border-border-subtle bg-bg-overlay/40 text-text-muted"
                    }`}
                  >
                    {img.isPublic ? "Public" : "Private"}
                  </span>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2">
                    <div className="mb-0.5 font-mono text-[7px] uppercase tracking-widest text-accent/90">Ch.{img.chapterNumberAtTime}</div>
                    <div className="line-clamp-2 font-serif text-[9px] leading-snug text-text-primary/90">{truncate(img.userPrompt, 80)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function queriesSection() {
    return (
      <div>
        <SectionLabel label="Recent questions" right={`${reader.recentQueries.length} shown`} />
        <div className="flex flex-col gap-2">
          {reader.recentQueries.length === 0 ? (
            <p className="text-sm text-text-secondary">No questions yet.</p>
          ) : (
            reader.recentQueries.map((q, i) => (
              <div
                key={q.id}
                className="dashboard-query-card rounded-lg border border-border-subtle bg-bg-surface/40 px-4 py-3.5"
                style={reducedMotion ? undefined : { animationDelay: `${i * 65}ms` }}
              >
                <div className="flex justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-accent/80">{q.bookTitle}</span>
                      <span className="font-mono text-[8px] text-text-muted">Ch. {q.chapterNumberAtTime}</span>
                    </div>
                    <p className="font-serif text-sm italic leading-relaxed text-text-primary">&ldquo;{truncate(q.questionText, 220)}&rdquo;</p>
                  </div>
                  <ActivityTimestamp ms={q.createdAtMs} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function partnerFeatureStatusClass(s: string) {
    if (s === "PENDING") return "border-warning/50 bg-warning/15 text-warning";
    if (s === "APPROVED") return "border-success/45 bg-success/15 text-success";
    if (s === "REJECTED") return "border-error/40 bg-error/10 text-error";
    return "border-border text-text-muted";
  }

  function partnerOwnFeatureRequestsSection() {
    if (!partner) return null;
    return (
      <div>
        <SectionLabel label="Your feature requests" right={`${partner.ownFeatureRequests.length} shown`} />
        {partner.ownFeatureRequests.length === 0 ? (
          <p className="text-sm text-text-secondary">No feature requests yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {partner.ownFeatureRequests.map((fr, i) => (
              <div
                key={fr.id}
                className="dashboard-stagger-item flex items-center gap-3.5 rounded-lg border border-border-subtle bg-bg-surface/35 px-4 py-3"
                style={reducedMotion ? undefined : { animationDelay: `${i * 65}ms` }}
              >
                <div className="relative h-12 w-[38px] shrink-0 overflow-hidden rounded border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fr.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 font-mono text-[8px] uppercase tracking-widest text-accent/60">
                    {fr.bookTitle} · Ch. {fr.chapterNumberAtTime}
                  </div>
                  <p className="truncate font-serif text-sm italic text-text-primary/80">&ldquo;{truncate(fr.userPrompt, 120)}&rdquo;</p>
                  <ActivityTimestamp ms={fr.createdAtMs} />
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide ${partnerFeatureStatusClass(fr.status)}`}
                >
                  {fr.status === "PENDING" ? "Pending" : fr.status === "APPROVED" ? "Featured" : fr.status === "REJECTED" ? "Rejected" : fr.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function myBooksSection() {
    if (!partner) return null;
    return (
      <div>
        {/* Prominent upload CTA — full-width dashed card, impossible to miss */}
        <Link href="/partner/books/new" className="dashboard-upload-cta block no-underline mb-6">
          <div className="dashboard-upload-cta-inner">
            <span className="dashboard-upload-cta-icon" aria-hidden>📤</span>
            <span className="dashboard-upload-cta-text">
              <span className="dashboard-upload-cta-title">Upload a new book</span>
              <span className="dashboard-upload-cta-sub">Publish an EPUB to the NovelViz catalogue</span>
            </span>
            <span className="dashboard-upload-cta-arrow" aria-hidden>→</span>
          </div>
        </Link>
        <SectionLabel label="Your published books" right={`${partner.stats.totalBooks} in catalogue`} />
        <PartnerDashboardBooksClient
          initialBooks={partner.initialBooks}
          initialHasMore={partner.initialHasMore}
          pageSize={partner.pageSize}
          variant="dashboard"
        />
      </div>
    );
  }

  function analyticsSection() {
    if (!partner) return null;
    return (
      <div className="dashboard-analytics-shell">
        <PartnerDashboardAnalytics data={partner.analytics} />
      </div>
    );
  }

  function allUsersSection() {
    return (
      <div className="dashboard-all-users-wrap space-y-3">
        <p className="text-sm text-text-secondary">
          <Link href="/admin/users" className="font-medium text-accent-text underline-offset-2 hover:underline">
            Open full user management →
          </Link>
        </p>
        <UsersAdminClient variant="embedded" />
      </div>
    );
  }

  function adminStatsSection() {
    if (!adminStats || !admin) return null;
    return (
      <div className="dashboard-adminstats-shell space-y-8">
        {/* Book requests — unique to this tab, not shown elsewhere */}
        <section aria-labelledby="dashboard-admin-book-requests">
          <SectionLabel label="Book requests" />
          <p className="text-sm text-text-secondary">
            Total requests recorded:{" "}
            <span className="font-semibold text-text-primary">{admin.bookRequests.totalCount}</span>
          </p>
          <h3 className="mt-3 font-mono text-[8px] font-semibold uppercase tracking-widest text-text-muted">Top requested titles</h3>
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

        {/* Platform statistics with charts and vendor billing */}
        <AdminStatsClient initialData={adminStats} />
      </div>
    );
  }

  function mainInner() {
    switch (tab) {
      case "overview":
        return overviewSection();
      case "reading":
        return readingSection();
      case "images":
        return imagesSection();
      case "queries":
        return queriesSection();
      case "partner-program":
        return (
          <DashboardPartnerSection
            lockedFullName={account.user.name?.trim() || reader.displayName}
            lockedUsername={reader.username?.trim() || null}
            lockedEmail={reader.email}
          />
        );
      case "account":
        return (
          <div className="dashboard-account-shell">
            <SectionLabel label="Profile" />
            <AccountPageClient
              viewerId={account.viewerId}
              user={account.user}
              stats={account.stats}
              memberSinceLabel={account.memberSinceLabel}
              isProduction={account.isProduction}
            />
          </div>
        );
      case "my-books":
        return myBooksSection();
      case "stats":
        return analyticsSection();
      case "feature-requests":
        return partnerOwnFeatureRequestsSection();
      case "for-review":
        return admin ? (
          <ForReviewQueue
            pendingBooks={pendingBooks}
            pendingReviewCount={admin.pendingReviewCount}
            actionId={actionId}
            onModeration={(id, status) => void runModeration(id, status)}
            onBookDeleted={handleForReviewBookDeleted}
            hasMorePending={hasMorePendingBooks}
            onLoadMorePending={() => void loadMorePendingBooks()}
            loadingMorePending={loadingMorePending}
            loadMorePendingErr={loadMorePendingErr}
            returnTo="/dashboard?tab=for-review"
            className="dashboard-for-review-wrap dashboard-admin-queue-wrap"
          />
        ) : null;
      case "feature-approvals":
        return admin ? (
          <FeatureRequestsQueue
            items={featureRequestQueue}
            actionRequestId={featureActionId}
            onDecision={(requestId, action) => void runFeatureRequestDecision(requestId, action)}
            className="dashboard-feature-queue-wrap dashboard-admin-queue-wrap"
          />
        ) : null;
      case "spoiler-comments":
        return admin ? (
          <SpoilerCommentsQueue
            items={admin.spoilerCommentsQueue}
            className="dashboard-spoiler-comments-wrap dashboard-admin-queue-wrap"
          />
        ) : null;
      case "flagged-comments":
        return admin ? (
          <FlaggedCommentsQueue
            items={admin.flaggedCommentsQueue}
            className="dashboard-flagged-comments-wrap"
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
            returnTo="/dashboard?tab=all-books"
          />
        ) : null;
      case "all-users":
        return allUsersSection();
      case "admin-stats":
        return adminStatsSection();
      default:
        return overviewSection();
    }
  }

  return (
    <div className="dashboard-root">
      <div className="dashboard-root-inner">
        <div className="dashboard-body">
          {sidebarOpen ? (
            <button
              type="button"
              className="dashboard-sidebar-backdrop"
              aria-label="Close menu"
              onClick={closeSidebar}
            />
          ) : null}
          <aside
            id="dashboard-sidebar"
            className="dashboard-sidebar"
            data-open={sidebarOpen ? "true" : "false"}
          >
            <div className="dashboard-sidebar-user">
              <div className="dashboard-sidebar-role">{roleDisplayLabel}</div>
              <div className="dashboard-sidebar-name">{reader.displayName}</div>
            </div>
            {/* Dynamic CTA: partners/admins get Upload New Book; readers get Become a Publisher */}
            <div className="dashboard-sidebar-cta-wrap">
              {role === "reader" ? (
                <button
                  type="button"
                  className="dashboard-sidebar-cta"
                  onClick={() => { pushTab("partner-program"); closeSidebar(); }}
                >
                  ✦ Become a Publisher
                </button>
              ) : (
                <Link
                  href="/partner/books/new"
                  className="dashboard-sidebar-cta no-underline"
                  onClick={closeSidebar}
                >
                  ＋ Upload New Book
                </Link>
              )}
            </div>
            {navEntries.map(renderNavRow)}
          </aside>

          <main className="dashboard-main">
            <div key={tab} className="dashboard-section-head dashboard-section-head--animate">
              <div className="dashboard-section-head-row">
                <div className="dashboard-section-head-text">
                  <div className="dashboard-section-eyebrow">
                    {reader.displayName} · {roleDisplayLabel}
                  </div>
                  {tab !== "partner-program" ? (
                    <h1 className="dashboard-section-title">{dashboardPageTitle(tab)}</h1>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="dashboard-sidebar-toggle"
                  aria-expanded={sidebarOpen}
                  aria-controls="dashboard-sidebar"
                  onClick={() => setSidebarOpen((o) => !o)}
                >
                  <SidebarToggleIcon open={sidebarOpen} />
                  <span className="dashboard-sidebar-toggle-label">
                    {sidebarOpen ? "Close" : "Menu"}
                  </span>
                </button>
              </div>
            </div>
            {mainInner()}
          </main>
        </div>
      </div>
    </div>
  );
}
