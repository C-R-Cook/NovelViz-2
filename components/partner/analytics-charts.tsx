"use client";

import React, { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [name]);

  return value;
}

function AnalyticsTooltip({ active, label, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === "number" ? raw : Number(raw);
  return (
    <div className="rounded-lg border border-border bg-bg-raised px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-accent">
        {Number.isFinite(v) ? v.toLocaleString() : String(raw)}
      </p>
    </div>
  );
}

type AreaRow = { label: string; [key: string]: string | number };

/** Slightly bolder than bare `var(--border)` so grids read clearly on dark fills. */
const GRID_BASE = {
  stroke: "var(--border)",
  strokeOpacity: 0.58,
} as const;

type BarRow = { label: string; count?: number; total?: number };

export function ReadersOverTimeArea({ data, valueKey }: { data: AreaRow[]; valueKey: string }) {
  const accent = useCSSVar("--accent");
  const gid = useId().replace(/:/g, "");
  const gradId = `readerFill-${gid}`;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          {...GRID_BASE}
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          width={44}
        />
        <Tooltip content={AnalyticsTooltip} />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke="var(--accent)"
          strokeWidth={2}
          fill={`url(#${gradId})`}
          style={{ filter: "drop-shadow(0 0 3px var(--accent))" }}
          dot={false}
          activeDot={{
            r: 5,
            fill: "var(--accent)",
            stroke: "var(--bg-base)",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PartnerHorizontalBarChart({
  data,
  valueKey,
  height,
}: {
  data: BarRow[];
  valueKey: "count" | "total";
  height?: number;
}) {
  const accent = useCSSVar("--accent");
  const h = height ?? Math.max(220, data.length * 40);
  const barGradId = `partner-hbar-fill-${useId().replace(/:/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart layout="vertical" data={data} margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
        <defs>
          <linearGradient id={barGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity={1} />
            <stop offset="55%" stopColor={accent} stopOpacity={0.92} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.78} />
          </linearGradient>
        </defs>
        <CartesianGrid
          {...GRID_BASE}
          strokeDasharray="4 4"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <Tooltip content={AnalyticsTooltip} />
        <Bar dataKey={valueKey} fill={`url(#${barGradId})`} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChapterEngagementBarChart({ data }: { data: { chapter: number; total: number }[] }) {
  const accent = useCSSVar("--accent");
  const barGradId = `chapter-bar-fill-${useId().replace(/:/g, "")}`;
  const rows = data.map((d) => ({ label: `Ch. ${d.chapter}`, total: d.total }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id={barGradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity={0.76} />
            <stop offset="45%" stopColor={accent} stopOpacity={0.9} />
            <stop offset="100%" stopColor={accent} stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid
          {...GRID_BASE}
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          width={36}
        />
        <Tooltip content={AnalyticsTooltip} />
        <Bar dataKey="total" fill={`url(#${barGradId})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
