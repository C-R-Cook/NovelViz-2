"use client";

import { formatUsd } from "@/lib/costs";
import type { DailyCountPoint } from "@/lib/costs";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

function useCSSVar(name: string): string {
  const [value, setValue] = React.useState(() => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  });

  React.useEffect(() => {
    const update = () => {
      const computed = getComputedStyle(document.body).getPropertyValue(name).trim();
      if (computed) setValue(computed);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [name]);

  return value;
}

const GRID_BASE = {
  stroke: "var(--border)",
  strokeOpacity: 0.58,
} as const;

function formatChartDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

function CountTooltip({ active, label, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === "number" ? raw : Number(raw);
  return (
    <div className="rounded-lg border border-border bg-bg-raised px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label ? formatChartDayLabel(String(label)) : ""}</p>
      <p className="mt-0.5 text-sm font-semibold text-accent">
        {Number.isFinite(v) ? v.toLocaleString() : String(raw)}
      </p>
    </div>
  );
}

function UsdTooltip({ active, label, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === "number" ? raw : Number(raw);
  return (
    <div className="rounded-lg border border-border bg-bg-raised px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label ? formatChartDayLabel(String(label)) : ""}</p>
      <p className="mt-0.5 text-sm font-semibold text-accent">
        {Number.isFinite(v) ? formatUsd(v) : String(raw)}
      </p>
    </div>
  );
}

export function AdminStatsLineChart({
  title,
  data,
  valueLabel = "count",
}: {
  title: string;
  data: DailyCountPoint[];
  /** dataKey on each row — default count */
  valueLabel?: string;
}) {
  const accent = useCSSVar("--accent");

  return (
    <section className="rounded-lg border border-border bg-bg-surface/90 p-4 sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</h3>
      <div className="mt-4 h-[260px] w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid {...GRID_BASE} strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDayLabel}
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={CountTooltip} />
            <Line
              type="monotone"
              dataKey={valueLabel}
              stroke={accent || "var(--accent)"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: accent || "var(--accent)", stroke: "var(--bg-base)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type DailyUsdPoint = { date: string; amountUsd: number };

export function AdminStatsSpendBarChart({ title, data }: { title: string; data: DailyUsdPoint[] }) {
  const accent = useCSSVar("--accent");
  const barGradId = `adminStatsBar-${React.useId().replace(/:/g, "")}`;

  return (
    <div className="mt-4 h-[180px] w-full">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={barGradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity={0.72} />
              <stop offset="100%" stopColor={accent} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_BASE} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDayLabel}
            tick={{ fill: "var(--text-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            width={44}
            tickFormatter={(v) => formatUsd(Number(v))}
          />
          <Tooltip content={UsdTooltip} />
          <Bar dataKey="amountUsd" fill={`url(#${barGradId})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
