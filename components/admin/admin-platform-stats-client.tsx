"use client";

import { PartnerHorizontalBarChart } from "@/components/partner/analytics-charts";
import type { AdminPlatformStatsPayload } from "@/lib/admin-platform-stats";

function formatStatusLabel(status: string): string {
  if (status === "pending_review") return "Pending review";
  return status.replace(/_/g, " ");
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 border-b-2 border-accent-muted pb-3 font-serif text-3xl font-semibold tabular-nums text-accent">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function AdminPlatformStatsClient({
  data,
}: {
  data: AdminPlatformStatsPayload;
}) {
  const statusChartRows = data.booksByStatus.map((row) => ({
    label: formatStatusLabel(row.status),
    total: row.count,
  }));

  const tokenCompareRows = [
    { label: "Q&A (token sum)", total: data.tokenTotals.fromQueries },
    { label: "Images (token sum)", total: data.tokenTotals.fromImages },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="platform-kpis">
        <h2 id="platform-kpis" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Platform overview
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={data.totalUsers} />
          <StatCard label="Books (not deleted)" value={data.totalBooksActive} />
          <StatCard label="Total queries" value={data.totalQueries} />
          <StatCard label="Total images generated" value={data.totalGeneratedImages} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Estimated AI tokens (lifetime)
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold tabular-nums text-accent-text">
              {data.tokenTotals.grandTotal.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              Sum of prompt, completion, and embedding token fields across{" "}
              <strong className="font-medium text-text-primary">Query</strong> and{" "}
              <strong className="font-medium text-text-primary">GeneratedImage</strong> rows (missing values count as
              0).
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-bg-surface/90 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Books by status
          </h3>
          <p className="mt-1 text-xs text-text-secondary">Live rows only (excluding deleted).</p>
          <div className="mt-4 min-h-[220px] w-full">
            {statusChartRows.length === 0 ? (
              <p className="text-sm text-text-muted">No books yet.</p>
            ) : (
              <PartnerHorizontalBarChart data={statusChartRows} valueKey="total" height={Math.max(220, statusChartRows.length * 40)} />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-bg-surface/90 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Tokens by surface
          </h3>
          <p className="mt-1 text-xs text-text-secondary">Totals summed from token columns in the database.</p>
          <div className="mt-4 min-h-[220px] w-full">
            <PartnerHorizontalBarChart data={tokenCompareRows} valueKey="total" height={240} />
          </div>
        </section>
      </div>
    </div>
  );
}
