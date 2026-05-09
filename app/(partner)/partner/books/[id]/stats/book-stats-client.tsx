"use client";

import {
  ChapterEngagementBarChart,
  ReadersOverTimeArea,
} from "@/components/partner/analytics-charts";
import type { PartnerBookAnalyticsPayload } from "@/lib/partner-book-analytics";
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

function StatCard({ label, value, decimals }: { label: string; value: number; decimals?: number }) {
  const targetInt = decimals === 1 ? Math.round(value * 10) : Math.round(value);
  const animated = useCountUp(targetInt);
  const display =
    decimals === 1 ? (animated / 10).toFixed(1) : animated.toLocaleString();
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 border-b-2 border-accent-muted pb-3 font-serif text-3xl font-semibold tabular-nums text-accent">
        {display}
      </p>
    </div>
  );
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
        <StatCard label="Engagement rate" value={data.engagement} decimals={1} />
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Readers over time
        </h2>
        <p className="mt-1 text-xs text-text-secondary">Cumulative adds to library for this title</p>
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ReadersOverTimeArea data={areaData} valueKey="cumulativeReaders" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Chapter engagement
        </h2>
        <p className="mt-1 text-xs text-text-secondary">Questions and images attributed to each chapter</p>
        <div className="mt-4 min-h-[280px] w-full min-w-0">
          <ChapterEngagementBarChart data={data.chapterEngagement} />
        </div>
      </section>
    </div>
  );
}
