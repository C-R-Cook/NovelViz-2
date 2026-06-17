"use client";

import {
  ChapterEngagementStackedBarChart,
  EngagementOverTimeChart,
  ReadersOverTimeArea,
  ReadingDepthChart,
} from "@/components/partner/analytics-charts";
import type { PartnerBookAnalyticsPayload } from "@/lib/partner-book-analytics";
import {
  PARTNER_ACTIONS_PER_READER_HELP,
  PARTNER_ACTIONS_PER_READER_LABEL,
} from "@/lib/partner-stat-labels";
import { PartnerStatLabelWithHelp } from "@/components/partner/partner-stat-label-with-help";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

function useCountUp(target: number, durationMs = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function StatCard({
  label,
  value,
  decimals,
  helpTooltip,
}: {
  label: string;
  value: number;
  decimals?: number;
  helpTooltip?: string;
}) {
  const targetInt = decimals === 1 ? Math.round(value * 10) : Math.round(value);
  const animated = useCountUp(targetInt);
  const display =
    decimals === 1 ? (animated / 10).toFixed(1) : animated.toLocaleString();
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {helpTooltip ? (
          <PartnerStatLabelWithHelp label={label} tooltip={helpTooltip} />
        ) : (
          label
        )}
      </p>
      <p className="mt-2 border-b-2 border-accent-muted pb-3 font-serif text-3xl font-semibold tabular-nums text-accent">
        {display}
      </p>
    </div>
  );
}

function truncateQuestion(text: string, max = 220) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function formatQuestionWhen(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BookStatsClient({
  data,
  backHref,
}: {
  data: PartnerBookAnalyticsPayload;
  backHref: string;
}) {
  const { book } = data;
  const areaData = data.readersOverTime.map((p) => ({
    label: p.label,
    cumulativeReaders: p.cumulativeReaders,
  }));
  const engagementData = data.engagementOverTime.map((p) => ({
    label: p.label,
    questions: p.questions,
    images: p.images,
  }));
  const depthData = data.readingDepth.map((row) => ({
    label: `Ch. ${row.chapter}`,
    readersReached: row.readersReached,
  }));
  const hasEngagementActivity = engagementData.some((p) => p.questions > 0 || p.images > 0);
  const hasDepth = depthData.some((p) => p.readersReached > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link
          href={backHref}
          className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
        >
          ← Back
        </Link>
      </div>

      <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start">
        <div className="relative h-40 w-[5.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm sm:h-48 sm:w-32">
          {book.coverImageUrl ? (
            <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="128px" />
          ) : (
            <div className="flex h-full items-center justify-center px-1 text-center text-xs text-text-muted">
              No cover
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {book.title}
          </h1>
          <p className="mt-1 text-text-secondary">{book.author}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-text-muted">Statistics</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Readers" value={data.readerCount} />
        <StatCard label="Questions" value={data.queryCount} />
        <StatCard label="Images" value={data.imageCount} />
        <StatCard
          label={PARTNER_ACTIONS_PER_READER_LABEL}
          value={data.engagement}
          decimals={1}
          helpTooltip={PARTNER_ACTIONS_PER_READER_HELP}
        />
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Gallery impact</h2>
        <p className="mt-1 text-xs text-text-secondary">Public images from this title on NovelViz</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Public images" value={data.gallery.publicImages} />
          <StatCard label="Featured on Discover" value={data.gallery.featuredImages} />
          <StatCard label="Total likes" value={data.gallery.totalLikes} />
          <StatCard label="Comments" value={data.gallery.commentCount} />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Readers over time
        </h2>
        <p className="mt-1 text-xs text-text-secondary">Cumulative adds to library for this title</p>
        <div className="mt-4 h-[200px] w-full min-w-0 overflow-hidden">
          <ReadersOverTimeArea data={areaData} valueKey="cumulativeReaders" height={200} />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Engagement over time
        </h2>
        <p className="mt-1 text-xs text-text-secondary">New questions and images each month (last 12 months)</p>
        {hasEngagementActivity ? (
          <div className="mt-4 h-[220px] w-full min-w-0 overflow-hidden">
            <EngagementOverTimeChart data={engagementData} height={220} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No engagement activity yet for this title.</p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Chapter engagement
        </h2>
        <p className="mt-1 text-xs text-text-secondary">Questions and images attributed to each chapter</p>
        <div className="mt-4 min-h-[280px] w-full min-w-0">
          <ChapterEngagementStackedBarChart data={data.chapterEngagement} />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          How far readers have reached
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Cumulative readers who have progressed to at least each chapter
        </p>
        {data.libraryAddsWithoutProgress > 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            {data.libraryAddsWithoutProgress.toLocaleString()} library add
            {data.libraryAddsWithoutProgress === 1 ? "" : "s"} without reading progress recorded yet.
          </p>
        ) : null}
        {hasDepth ? (
          <div className="mt-4 h-[260px] w-full min-w-0 overflow-hidden">
            <ReadingDepthChart data={depthData} height={260} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No reading progress recorded yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Recent questions
            </h2>
            <p className="mt-1 text-xs text-text-secondary">Latest reader questions for this title</p>
          </div>
          <Link
            href="/dashboard?tab=feature-requests"
            className="text-xs font-medium text-accent-text underline-offset-2 hover:underline"
          >
            View all in dashboard
          </Link>
        </div>
        {data.recentQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No questions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.recentQuestions.map((q) => (
              <li key={q.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-text-primary">{truncateQuestion(q.questionText)}</p>
                <p className="mt-1 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">@{q.username}</span>
                  <span aria-hidden> · </span>
                  Chapter {q.chapterNumberAtTime}
                  <span aria-hidden> · </span>
                  {formatQuestionWhen(q.createdAtMs)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
