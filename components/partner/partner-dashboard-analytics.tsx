"use client";

import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import {
  PARTNER_AVG_ACTIONS_PER_READER_HELP,
  PARTNER_AVG_ACTIONS_PER_READER_LABEL,
} from "@/lib/partner-stat-labels";
import { PartnerStatLabelWithHelp } from "@/components/partner/partner-stat-label-with-help";
import {
  EngagementOverTimeChart,
  PartnerHorizontalBarChart,
  ReadersOverTimeArea,
} from "@/components/partner/analytics-charts";
import { useEffect, useState } from "react";

function useCountUp(target: number, durationMs = 1000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (target - from) * eased));
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

export function PartnerDashboardAnalytics({ data }: { data: PartnerAnalyticsPayload }) {
  const areaData = data.readersOverTime.map((p) => ({
    label: p.label,
    cumulativeReaders: p.cumulativeReaders,
  }));

  const engagementData = data.engagementOverTime.map((p) => ({
    label: p.label,
    questions: p.questions,
    images: p.images,
  }));
  const hasEngagementActivity = engagementData.some((p) => p.questions > 0 || p.images > 0);

  const topBooksChartData = data.topBooks.map((b) => ({
    label: b.title.length > 36 ? `${b.title.slice(0, 35)}…` : b.title,
    total: b.engagement,
  }));

  const ageData = data.ageBuckets.filter((b) => b.count > 0);
  const genreData = data.genreBuckets.filter((b) => b.count > 0);

  return (
    <section className="space-y-8" aria-labelledby="partner-overall-stats">
      <div>
        <h2 id="partner-overall-stats" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Overall stats
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total readers" value={data.distinctReaderCount} />
          <StatCard label="Total questions asked" value={data.totalQueries} />
          <StatCard label="Total images generated" value={data.totalImages} />
          <StatCard
            label={PARTNER_AVG_ACTIONS_PER_READER_LABEL}
            value={data.avgEngagement}
            decimals={1}
            helpTooltip={PARTNER_AVG_ACTIONS_PER_READER_HELP}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Readers over time
        </h3>
        <p className="mt-1 text-xs text-text-secondary">Cumulative library adds across your books (last 12 months)</p>
        {areaData.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No reader data yet — stats will appear once readers start adding your books.</p>
        ) : (
          <div className="mt-4 h-[200px] w-full min-w-0 overflow-hidden">
            <ReadersOverTimeArea data={areaData} valueKey="cumulativeReaders" height={200} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Engagement over time
        </h3>
        <p className="mt-1 text-xs text-text-secondary">Monthly questions and images across your catalogue</p>
        {hasEngagementActivity ? (
          <div className="mt-4 h-[220px] w-full min-w-0 overflow-hidden">
            <EngagementOverTimeChart data={engagementData} height={220} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">No engagement activity yet.</p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Gallery impact</h3>
        <p className="mt-1 text-xs text-text-secondary">Public images from your titles</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Public images" value={data.gallery.publicImages} />
          <StatCard label="Featured on Discover" value={data.gallery.featuredImages} />
          <StatCard label="Total likes" value={data.gallery.totalLikes} />
          <StatCard label="Comments" value={data.gallery.commentCount} />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Top books by engagement</h3>
        <p className="mt-1 text-xs text-text-secondary">Questions plus images (top 5 titles)</p>
        <div className="mt-4 min-h-[160px] w-full min-w-0">
          {topBooksChartData.length === 0 ? (
            <p className="text-sm text-text-muted">No engagement data yet.</p>
          ) : (
            <PartnerHorizontalBarChart data={topBooksChartData} valueKey="total" />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Readers by age range
          </h3>
          <p className="mt-1 text-xs text-text-secondary">Users with at least one of your books in their library</p>
          <div className="mt-4 min-h-[160px] w-full min-w-0">
            {ageData.length === 0 ? (
              <p className="text-sm text-text-muted">Not enough age data yet.</p>
            ) : (
              <PartnerHorizontalBarChart data={ageData} valueKey="count" />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Readers by genre preference
          </h3>
          <p className="mt-1 text-xs text-text-secondary">From reader profile preferences</p>
          <div className="mt-4 min-h-[160px] w-full min-w-0">
            {genreData.length === 0 ? (
              <p className="text-sm text-text-muted">No genre preferences recorded yet.</p>
            ) : (
              <PartnerHorizontalBarChart data={genreData} valueKey="count" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
