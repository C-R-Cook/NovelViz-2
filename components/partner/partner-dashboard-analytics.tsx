"use client";

import type { PartnerAnalyticsPayload } from "@/lib/partner-analytics";
import {
  ChapterEngagementBarChart,
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

export function PartnerDashboardAnalytics({ data }: { data: PartnerAnalyticsPayload }) {
  const areaData = data.readersOverTime.map((p) => ({
    label: p.label,
    cumulativeReaders: p.cumulativeReaders,
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
          <StatCard label="Avg. engagement" value={data.avgEngagement} decimals={1} />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Readers over time
        </h3>
        <p className="mt-1 text-xs text-text-secondary">Cumulative library adds across your books (last 12 months)</p>
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ReadersOverTimeArea data={areaData} valueKey="cumulativeReaders" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Readers by age range
          </h3>
          <p className="mt-1 text-xs text-text-secondary">Users with at least one of your books in their library</p>
          <div className="mt-4 min-h-[200px] w-full min-w-0">
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
          <div className="mt-4 min-h-[200px] w-full min-w-0">
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
