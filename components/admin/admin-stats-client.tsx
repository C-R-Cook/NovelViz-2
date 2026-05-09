"use client";

import type { AdminStatsPayload } from "@/lib/admin-stats";
import type { FalVendorSnapshot, OpenAiVendorSnapshot } from "@/lib/admin-vendors";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface px-3 py-2.5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1.5 border-b border-accent-muted/70 pb-1.5 font-serif text-xl font-semibold leading-none tabular-nums text-accent">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub ? <p className="mt-1 text-[11px] leading-tight text-text-secondary">{sub}</p> : null}
    </div>
  );
}

function formatChartDate(d: string): string {
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function VendorLiveBadge() {
  return (
    <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">
      Live
    </span>
  );
}

function VendorSpendMiniChart({ data }: { data: { date: string; amountUsd: number }[] }) {
  return (
    <div className="mt-3 h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip formatter={(v: number) => `$${Number(v).toFixed(4)}`} />
          <Bar dataKey="amountUsd" fill="var(--accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpenAiCard({
  openai,
  message,
  days,
}: {
  openai: OpenAiVendorSnapshot | null;
  message: string | null;
  days: number;
}) {
  if (!openai) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-text-primary">OpenAI</h3>
        <p className="mt-2 text-sm text-text-secondary italic">
          {message ?? "Configure OPENAI_ADMIN_API_KEY to see live OpenAI billing data."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">OpenAI</h3>
        <VendorLiveBadge />
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        Total spend ({days} days):{" "}
        <span className="font-semibold tabular-nums text-text-primary">${openai.totalSpendUsd.toFixed(4)}</span>
      </p>
      {openai.totalEmbeddingTokens != null ? (
        <p className="mt-1 text-sm text-text-secondary">
          Embedding tokens:{" "}
          <span className="tabular-nums text-text-primary">{openai.totalEmbeddingTokens.toLocaleString()}</span>
        </p>
      ) : null}
      <VendorSpendMiniChart data={openai.dailySpendUsd} />
    </div>
  );
}

function FalCard({
  fal,
  message,
  days,
}: {
  fal: FalVendorSnapshot | null;
  message: string | null;
  days: number;
}) {
  if (!fal) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-text-primary">fal.ai</h3>
        <p className="mt-2 text-sm text-text-secondary italic">
          {message ?? "No fal.ai usage data available. Check FAL_API_KEY is set."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">fal.ai</h3>
        <VendorLiveBadge />
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        Total spend ({days} days):{" "}
        <span className="font-semibold tabular-nums text-text-primary">${fal.totalSpendUsd.toFixed(4)}</span>
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Images billed:{" "}
        <span className="tabular-nums text-text-primary">{fal.imagesGenerated.toLocaleString()}</span>
      </p>
      {fal.byModel.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-text-muted pb-2">Model</th>
                <th className="text-left text-xs text-text-muted pb-2">Images</th>
                <th className="text-left text-xs text-text-muted pb-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {fal.byModel.map((row) => (
                <tr key={row.endpointId}>
                  <td className="py-1.5 border-t border-border text-text-secondary">{row.endpointId}</td>
                  <td className="py-1.5 border-t border-border tabular-nums text-text-primary">
                    {row.quantity.toLocaleString()}
                  </td>
                  <td className="py-1.5 border-t border-border tabular-nums text-text-primary">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <VendorSpendMiniChart data={fal.dailySpendUsd} />
    </div>
  );
}

export function AdminStatsClient({ initialData: data }: { initialData: AdminStatsPayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setVendorWindowDays(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vendorDays", String(days));
    const q = params.toString();
    const href = q ? `${pathname}?${q}` : pathname ?? "/dashboard";
    router.replace(href, { scroll: false });
  }

  const { kpis } = data;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-8">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary">Platform statistics</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Activity charts use the last 30 UTC days. Vendor billing uses the selected period. Updated{" "}
            <time dateTime={data.generatedAt} className="tabular-nums">
              {new Date(data.generatedAt).toLocaleString()}
            </time>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-lg bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised"
        >
          Refresh
        </button>
      </div>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">KPI</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="New Users (30 days)" value={kpis.newUsersLast30Days} />
          <StatCard label="Library Adds" value={kpis.libraryAddsTotal} />
          <StatCard label="Published Books" value={kpis.publishedBooks} />
          <StatCard label="Total Q&A Queries" value={kpis.totalQueries} />
          <StatCard label="Total Images Generated" value={kpis.totalGeneratedImages} />
          <StatCard label="Queries (30 days)" value={kpis.queriesLast30Days} />
          <StatCard label="Images (30 days)" value={kpis.imagesLast30Days} />
          <StatCard label="Total Likes" value={kpis.totalLikes} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Activity Charts</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">Q&A Queries per Day</h3>
            <div className="mt-3 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.queriesByDay}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--accent)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">Images Generated per Day</h3>
            <div className="mt-3 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.imagesByDay}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--accent)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary">New Users per Day</h3>
          <div className="mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.userGrowthByDay}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--accent)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Estimated AI Costs</h2>
        <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-text-muted pb-2">Operation</th>
                <th className="text-left text-xs text-text-muted pb-2">Provider</th>
                <th className="text-left text-xs text-text-muted pb-2">Est. Cost (all time)</th>
              </tr>
            </thead>
            <tbody>
              {data.internal.estimatedCosts.rows.map((row) => (
                <tr key={row.operation}>
                  <td className="py-1.5 border-t border-border text-text-primary">{row.operation}</td>
                  <td className="py-1.5 border-t border-border text-text-secondary">{row.provider}</td>
                  <td className="py-1.5 border-t border-border tabular-nums text-text-primary">{row.estCostFormatted}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5 border-t border-border text-text-primary">Total estimated</td>
                <td className="py-1.5 border-t border-border text-text-secondary" />
                <td className="py-1.5 border-t border-border tabular-nums text-text-primary">{data.internal.estimatedCosts.totalFormatted}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-text-secondary">{data.internal.footnote}</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Vendor Billing (Live)</h2>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Period
            <select
              value={String(data.vendorWindowDays)}
              onChange={(e) => setVendorWindowDays(Number(e.target.value))}
              className="rounded-md border border-border bg-bg-raised px-2 py-1 text-xs text-text-primary outline-none ring-0"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OpenAiCard
            openai={data.vendors.openai}
            message={data.vendorMessages.openai}
            days={data.vendorWindowDays}
          />
          <FalCard fal={data.vendors.fal} message={data.vendorMessages.fal} days={data.vendorWindowDays} />
          <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">Anthropic</h3>
            <p className="mt-2 text-sm text-text-secondary italic">
              This account is an individual Anthropic API account. The Anthropic usage API requires an organisation
              account. Cost estimates are calculated from stored token counts - see the Estimated AI Costs section above.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary">Neon</h3>
            <p className="mt-2 text-sm text-text-secondary italic">
              Upgrade to Neon Launch plan and add NEON_API_KEY to enable database usage metrics: compute hours, storage
              GB-months, and network transfer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
