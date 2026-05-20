"use client";

import type { FalVendorSnapshot } from "@/lib/admin-vendors";
import { SITE_IMAGINE_FAL_MODELS, type SiteImagineFalChartKey } from "@/lib/imagine-fal-models";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const FAL_CHART_HEIGHT = 112;
const FAL_STACKED_HEIGHT = 120;

const FAL_MODEL_CHART_COLORS: Record<SiteImagineFalChartKey, string> = {
  fluxSchnell: "var(--accent)",
  grok: "#7c9cbf",
  seedream: "#a68b5b",
};

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

export function FalUsageCard({
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
      <div className="rounded-xl border border-border bg-bg-surface p-3 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold text-text-primary">fal.ai (Imagine models)</h3>
        <p className="mt-2 text-sm text-text-secondary italic">
          {message ?? "No fal.ai usage data available. Check FAL_API_KEY is set."}
        </p>
      </div>
    );
  }

  const modelTotals = fal.byModel.map((row) => ({
    name: row.label,
    images: row.quantity,
    costUsd: row.costUsd,
    chartKey: SITE_IMAGINE_FAL_MODELS.find((m) => m.endpoint === row.endpointId)?.chartKey ?? "fluxSchnell",
  }));

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">fal.ai (Imagine models)</h3>
        <VendorLiveBadge />
      </div>
      <p className="mt-0.5 text-xs text-text-muted">
        flux/schnell, Grok Imagine, Seedream v4.5 only — excludes T2I tester endpoints
      </p>
      <p className="mt-1.5 text-sm text-text-secondary">
        Total spend ({days} days):{" "}
        <span className="font-semibold tabular-nums text-text-primary">${fal.totalSpendUsd.toFixed(4)}</span>
        {" · "}
        Images:{" "}
        <span className="tabular-nums text-text-primary">{fal.imagesGenerated.toLocaleString()}</span>
      </p>

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Images by model</h4>
          <div className="mt-1" style={{ height: FAL_CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelTotals} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number, _name, item) => {
                    const cost = (item?.payload as { costUsd?: number })?.costUsd;
                    const costLabel = typeof cost === "number" ? ` · $${cost.toFixed(4)}` : "";
                    return [`${Number(v).toLocaleString()} images${costLabel}`, "Total"];
                  }}
                />
                <Bar dataKey="images" radius={[0, 3, 3, 0]}>
                  {modelTotals.map((row) => (
                    <Cell key={row.name} fill={FAL_MODEL_CHART_COLORS[row.chartKey]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Spend by day</h4>
          <div className="mt-1" style={{ height: FAL_CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fal.dailySpendUsd} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  labelFormatter={formatChartDate}
                  formatter={(v: number) => [`$${Number(v).toFixed(4)}`, "Spend"]}
                />
                <Bar dataKey="amountUsd" fill="var(--accent)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Images per day</h4>
          <div className="mt-1" style={{ height: FAL_STACKED_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fal.dailyImagesByModel} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip labelFormatter={formatChartDate} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              {SITE_IMAGINE_FAL_MODELS.map((m) => (
                <Bar
                  key={m.chartKey}
                  stackId="images"
                  dataKey={m.chartKey}
                  name={m.label}
                  fill={FAL_MODEL_CHART_COLORS[m.chartKey]}
                />
              ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
