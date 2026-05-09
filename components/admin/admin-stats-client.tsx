"use client";

import { AdminStatsLineChart, AdminStatsSpendBarChart } from "@/components/admin/admin-stats-charts";
import type { AdminStatsPayload } from "@/lib/admin-stats";
import { formatUsd } from "@/lib/costs";
import { type ReactNode, useCallback, useState } from "react";

function KpiCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-2 border-b-2 border-accent-muted pb-3 font-serif text-3xl font-semibold tabular-nums text-accent">
        {value}
      </div>
    </div>
  );
}

export function AdminStatsClient({ initialData }: { initialData: AdminStatsPayload }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const next = (await res.json()) as AdminStatsPayload;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const { kpis } = data;

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-8">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary">Platform statistics</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Last 30 calendar days (UTC) for activity charts and vendor windows. Updated{" "}
            <time dateTime={data.generatedAt} className="tabular-nums">
              {new Date(data.generatedAt).toLocaleString()}
            </time>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:bg-bg-raised disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="admin-kpi-users">
        <h2 id="admin-kpi-users" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Users
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Total users" value={kpis.totalUsers.toLocaleString()} />
          <KpiCard label="New (last 30 days)" value={kpis.newUsersLast30Days.toLocaleString()} />
          <KpiCard label="Library adds" value={kpis.libraryAddsTotal.toLocaleString()} />
        </div>
      </section>

      <section aria-labelledby="admin-kpi-content">
        <h2 id="admin-kpi-content" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Content
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total books / published"
            value={
              <span className="text-2xl sm:text-3xl">
                {kpis.totalBooks.toLocaleString()} / {kpis.publishedBooks.toLocaleString()}
              </span>
            }
          />
          <KpiCard label="Total Q&A queries" value={kpis.totalQueries.toLocaleString()} />
          <KpiCard label="Total images generated" value={kpis.totalGeneratedImages.toLocaleString()} />
        </div>
      </section>

      <section aria-labelledby="admin-kpi-engagement">
        <h2 id="admin-kpi-engagement" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Engagement
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Total likes" value={kpis.totalLikes.toLocaleString()} />
          <KpiCard label="Queries (last 30 days)" value={kpis.queriesLast30Days.toLocaleString()} />
          <KpiCard label="Images (last 30 days)" value={kpis.imagesLast30Days.toLocaleString()} />
        </div>
      </section>

      <section aria-labelledby="admin-activity-charts">
        <h2 id="admin-activity-charts" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Activity
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <AdminStatsLineChart title="Q&A queries" data={data.charts.queriesByDay} />
          <AdminStatsLineChart title="Images generated" data={data.charts.imagesByDay} />
        </div>
        <div className="mt-6">
          <AdminStatsLineChart title="New users" data={data.charts.userGrowthByDay} />
        </div>
      </section>

      <section aria-labelledby="admin-ai-costs">
        <h2 id="admin-ai-costs" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          AI cost breakdown (estimated)
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-bg-surface shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-medium">Operation</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-medium">Est. cost (all time)</th>
              </tr>
            </thead>
            <tbody>
              {data.internal.estimatedCosts.rows.map((row) => (
                <tr key={row.operation} className="border-b border-border/80 last:border-0">
                  <td className="px-4 py-3 text-text-primary">{row.operation}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.provider}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">{row.estCostFormatted}</td>
                </tr>
              ))}
              <tr className="bg-bg-raised/40 font-semibold">
                <td className="px-4 py-3 text-text-primary" colSpan={2}>
                  Total estimated
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-accent">
                  {data.internal.estimatedCosts.totalFormatted}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-secondary">{data.internal.footnote}</p>
      </section>

      <section aria-labelledby="admin-vendor-billing">
        <h2 id="admin-vendor-billing" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Vendor billing
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">OpenAI (live)</h3>
            {data.vendors.openai ? (
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>
                  <span className="text-text-muted">Total spend (period): </span>
                  <span className="font-semibold tabular-nums text-accent">
                    {formatUsd(data.vendors.openai.totalSpendUsd)}
                  </span>
                </p>
                {data.vendors.openai.totalEmbeddingTokens != null ? (
                  <p>
                    <span className="text-text-muted">Embedding tokens (period): </span>
                    <span className="tabular-nums text-text-primary">
                      {data.vendors.openai.totalEmbeddingTokens.toLocaleString()}
                    </span>
                  </p>
                ) : null}
                <AdminStatsSpendBarChart title="Daily spend (UTC)" data={data.vendors.openai.dailySpendUsd} />
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                Configure OPENAI_ADMIN_API_KEY to see live billing data.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">fal.ai (live)</h3>
            {data.vendors.fal ? (
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>
                  <span className="text-text-muted">Total spend (period): </span>
                  <span className="font-semibold tabular-nums text-accent">
                    {formatUsd(data.vendors.fal.totalSpendUsd)}
                  </span>
                </p>
                <p>
                  <span className="text-text-muted">Images (usage summary): </span>
                  <span className="tabular-nums text-text-primary">
                    {data.vendors.fal.imagesGenerated.toLocaleString()}
                  </span>
                </p>
                {data.vendors.fal.byModel.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                    {data.vendors.fal.byModel.map((m) => (
                      <li key={m.endpointId} className="flex justify-between gap-2">
                        <span className="truncate text-text-muted" title={m.endpointId}>
                          {m.endpointId}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-primary">
                          {m.quantity.toLocaleString()} · {formatUsd(m.costUsd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <AdminStatsSpendBarChart title="Daily spend (UTC)" data={data.vendors.fal.dailySpendUsd} />
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                FAL_API_KEY not configured (or request failed). Use the same key as the app; Platform API uses{" "}
                <code className="text-text-primary">Authorization: Key …</code>.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Neon (database)</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Upgrade to Neon Launch plan and configure NEON_API_KEY to see database usage metrics. When available,
              this would include compute hours, storage GB, and network transfer.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-bg-surface p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Anthropic</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Anthropic usage API requires an organisation account. Cost estimates are calculated from stored token
              counts above.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
