"use client";

import { AccountPageClient, type AccountPageClientProps } from "@/app/(reader)/(app)/account/account-client";
import { DashboardLibrarySettings } from "@/app/(reader)/(app)/dashboard/dashboard-library-settings";
import { DashboardReaderImages } from "@/app/(reader)/(app)/dashboard/dashboard-reader-images";
import { DashboardPartnerSection } from "@/app/(reader)/(app)/dashboard/dashboard-partner-section";
import { FeatureImagesAdmin } from "@/app/(reader)/(app)/dashboard/feature-images-admin";
import { PartnerFeatureImages } from "@/app/(reader)/(app)/dashboard/partner-feature-images";
import {
  ForReviewQueue,
  toForReviewBook,
} from "@/app/(reader)/(app)/dashboard/for-review-queue";
import type { AdminFeatureImageRow } from "@/lib/admin-feature-images";
import { FOR_REVIEW_QUEUE_PAGE_SIZE, type AdminBookRow } from "@/lib/admin-books-shared";
import { CommentModerationQueue } from "@/app/(reader)/(app)/dashboard/comment-moderation-queue";
import type { AdminFlaggedCommentRow } from "@/lib/admin-flagged-comments-queue";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import { PartnerDashboardBooksClient } from "@/app/(partner)/partner/dashboard/partner-dashboard-books-client";
import { AdminBooksClient } from "@/app/admin/books/admin-books-client";
import { UsersAdminClient } from "@/app/admin/users/users-client";
import { AdminStatsClient } from "@/components/admin/admin-stats-client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { DashboardNavBadgeCounts } from "@/lib/dashboard-data";
import { PartnerDashboardAnalytics } from "@/components/partner/partner-dashboard-analytics";
import type { AdminStatsPayload } from "@/lib/admin-stats";
import {
  dashboardPageTitle,
  parseDashboardTab,
  type DashboardTabSlug,
  type DashboardUserRole,
} from "@/lib/dashboard-tab";
import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { PartnerDashboardBookRow } from "@/lib/partner-books-list";
import type { PartnerFeatureImageRow } from "@/lib/partner-feature-images";
import type { PartnerQueryRow } from "@/lib/partner-queries";
import type { FeatureRequestStatus } from "@db";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

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
    libraryBooks: {
      bookId: string;
      title: string;
      author: string;
      coverImageUrl: string | null;
      currentChapterNumber: number | null;
      chapterCount: number;
      queryCount: number;
      imageCount: number;
      progressPercent: number;
    }[];
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
      bookId: string;
      imageUrl: string;
      bookTitle: string;
      chapterNumberAtTime: number;
      userPrompt: string;
      fullPrompt: string;
      isPublic: boolean;
      isFeatured: boolean;
      likeCount: number;
      commentCount: number;
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
      status: FeatureRequestStatus;
      createdAtMs: number;
      bookTitle: string;
      chapterNumberAtTime: number;
      userPrompt: string;
      imageUrl: string;
    }[];
    ownFeatureRequestsPendingCount: number;
    initialPartnerFeatureImages: PartnerFeatureImageRow[];
    initialPartnerFeatureImagesHasMore: boolean;
    partnerFeatureImagesPageSize: number;
    initialPartnerQueries: PartnerQueryRow[];
    initialPartnerQueriesHasMore: boolean;
    partnerQueriesPageSize: number;
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
  adminFeatureImages: {
    featured: AdminFeatureImageRow[];
    featuredHasMore: boolean;
    pageSize: number;
  } | null;
  account: Pick<
    AccountPageClientProps,
    "viewerId" | "user" | "stats" | "memberSinceLabel" | "isProduction" | "accountStatus" | "creditBalance"
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

export function DashboardClient({
  role,
  roleDisplayLabel,
  reader,
  partner,
  admin,
  adminBooksAll,
  adminStats,
  adminFeatureImages,
  account,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();

  const tab = useMemo(
    () => parseDashboardTab(role, searchParams.get("tab") ?? undefined),
    [role, searchParams],
  );

  const badgeCounts = useMemo(
    (): DashboardNavBadgeCounts => ({
      forReview: admin?.pendingReviewCount ?? 0,
      featureApprovals: admin?.featureRequestsPendingCount ?? 0,
      commentModeration:
        (admin?.spoilerCommentsPendingCount ?? 0) + (admin?.flaggedCommentsPendingCount ?? 0),
      partnerFeatReq: partner?.ownFeatureRequestsPendingCount ?? 0,
    }),
    [admin, partner],
  );

  const [pendingBooks, setPendingBooks] = useState(admin?.pendingBooks ?? []);
  const [loadingMorePending, setLoadingMorePending] = useState(false);
  const [loadMorePendingErr, setLoadMorePendingErr] = useState<string | null>(null);
  const [featureRequestQueue, setFeatureRequestQueue] = useState(admin?.featureRequestsQueue ?? []);

  useEffect(() => {
    if (admin?.featureRequestsQueue) {
      setFeatureRequestQueue(admin.featureRequestsQueue);
    }
  }, [admin?.featureRequestsQueue]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [featureActionId, setFeatureActionId] = useState<string | null>(null);

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

  function librarySettingsSection() {
    return (
      <DashboardLibrarySettings
        stats={reader.stats}
        libraryBooks={reader.libraryBooks}
        reducedMotion={reducedMotion}
      />
    );
  }

  function imagesSection() {
    return (
      <DashboardReaderImages
        images={reader.recentImages}
        reducedMotion={reducedMotion}
        viewerRole={role}
      />
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
        <SectionLabel label="Published books" right={`${partner.stats.totalBooks} in catalogue`} />
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
            <Link
              href="/admin/requests"
              className="font-medium text-accent-text underline-offset-2 hover:underline"
            >
              View all book requests →
            </Link>
          </p>
          <p className="mt-3 text-sm text-text-secondary">
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
      case "reading":
        return librarySettingsSection();
      case "images":
        return imagesSection();
      case "queries":
        return queriesSection();
      case "partner-program":
        return (
          <DashboardPartnerSection
            lockedName={account.user.name}
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
              accountStatus={account.accountStatus}
              creditBalance={account.creditBalance}
              embedded
            />
          </div>
        );
      case "my-books":
        return myBooksSection();
      case "stats":
        return analyticsSection();
      case "feature-requests":
        return partner ? (
          <PartnerFeatureImages
            ownFeatureRequests={partner.ownFeatureRequests}
            initialImages={partner.initialPartnerFeatureImages}
            initialHasMore={partner.initialPartnerFeatureImagesHasMore}
            pageSize={partner.partnerFeatureImagesPageSize}
            initialQueries={partner.initialPartnerQueries}
            initialQueriesHasMore={partner.initialPartnerQueriesHasMore}
            queriesPageSize={partner.partnerQueriesPageSize}
            isAdminViewer={role === "admin"}
            className="dashboard-partner-feature-wrap"
          />
        ) : null;
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
        return admin && adminFeatureImages ? (
          <FeatureImagesAdmin
            featureRequests={featureRequestQueue}
            initialFeatured={adminFeatureImages.featured}
            initialFeaturedHasMore={adminFeatureImages.featuredHasMore}
            pageSize={adminFeatureImages.pageSize}
            actionRequestId={featureActionId}
            onDecision={(requestId, action) => void runFeatureRequestDecision(requestId, action)}
            onPendingRequestResolved={(imageId) =>
              setFeatureRequestQueue((prev) => prev.filter((r) => r.imageId !== imageId))
            }
            className="dashboard-feature-queue-wrap dashboard-admin-queue-wrap"
          />
        ) : null;
      case "comment-moderation":
        return admin ? (
          <CommentModerationQueue
            spoilerItems={admin.spoilerCommentsQueue}
            flaggedItems={admin.flaggedCommentsQueue}
            spoilerCount={admin.spoilerCommentsPendingCount}
            flaggedCount={admin.flaggedCommentsPendingCount}
            className="dashboard-comment-moderation-wrap dashboard-admin-queue-wrap"
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
        return librarySettingsSection();
    }
  }

  return (
    <DashboardShell
      role={role}
      roleDisplayLabel={roleDisplayLabel}
      displayName={reader.displayName}
      badgeCounts={badgeCounts}
      sectionTitle={tab === "partner-program" ? undefined : dashboardPageTitle(tab)}
      sectionEyebrow={`${reader.displayName} · ${roleDisplayLabel}`}
      sectionHeadVariant={tab === "partner-program" ? "toggle-only" : "default"}
    >
      <div key={tab}>{mainInner()}</div>
    </DashboardShell>
  );
}
