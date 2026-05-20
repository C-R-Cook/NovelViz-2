"use client";

import "@/components/admin/admin-vendor-charts.css";
import type { NeonVendorSnapshot } from "@/lib/admin-neon";
import {
  NEON_CHART_THEME,
  vendorChartAxisTick,
  vendorChartGridProps,
  vendorChartLegendStyle,
  vendorChartTooltipProps,
} from "@/lib/admin-vendor-chart-themes";
import type { ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const theme = NEON_CHART_THEME;
const tooltipProps = vendorChartTooltipProps(theme);
const axisTick = { ...vendorChartAxisTick(theme), fontSize: 10 };
const gridProps = vendorChartGridProps(theme);
const legendStyle = { ...vendorChartLegendStyle(theme), fontSize: 10 };
const CHART_HEIGHT = 112;
const CHART_HEIGHT_LEGEND = 128;

function formatChartDate(d: string): string {
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function VendorLiveBadge() {
  return <span className="vendor-live-badge">Live</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="vendor-stat-card">
      <p className="vendor-stat-label">{label}</p>
      <p className="vendor-stat-value">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub ? <p className="vendor-stat-sub">{sub}</p> : null}
    </div>
  );
}

function NeonUsageChart({
  title,
  subtitle,
  height = CHART_HEIGHT,
  children,
}: {
  title: string;
  subtitle?: string;
  height?: number;
  children: ReactElement;
}) {
  return (
    <div className="vendor-chart-panel vendor-chart-panel--compact">
      <div className="vendor-chart-heading">
        <h3 className="vendor-chart-title">{title}</h3>
        {subtitle ? <p className="vendor-chart-subtitle">{subtitle}</p> : null}
      </div>
      <div className="vendor-chart-plot" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function NeonUsageSection({
  neon,
  message,
  days,
}: {
  neon: NeonVendorSnapshot | null;
  message: string | null;
  days: number;
}) {
  if (!neon) {
    return (
      <div className={`vendor-charts ${theme.cssClass}`}>
        <h3 className="vendor-chart-title">Neon (consumption)</h3>
        <p className="vendor-chart-empty mt-2">
          {message ?? "Add NEON_API_KEY to .env.local and restart the dev server."}
        </p>
        <p className="vendor-chart-footnote mt-2">
          Requires a Launch (or higher) plan. Runtime RAM, CPU, and connection charts are only on Scale+ with
          observability export — not available via this API.
        </p>
      </div>
    );
  }

  const periodLabel =
    neon.apiDays < days
      ? `${neon.apiDays} days (Neon daily API max 60; window ${days}d)`
      : `${days} days`;

  const { storageBreakdownGbMonths: sb } = neon;
  const hasPrivateTransfer = neon.privateTransferGb > 0.001 || neon.daily.some((d) => d.privateTransferGb > 0);
  const hasExtraBranches =
    neon.extraBranchMonths > 0.001 || neon.daily.some((d) => d.extraBranchHours > 0);
  const hasChildOrSnapshot =
    sb.child > 0.001 ||
    sb.snapshot > 0.001 ||
    neon.daily.some((d) => d.childStorageGbAvg > 0 || d.snapshotStorageGbAvg > 0);

  const chartMargin = { top: 2, right: 4, left: 0, bottom: 0 };
  const yAxisWidth = 40;
  const gradPublicId = "neon-public-transfer-grad";
  const gradComputeId = "neon-compute-line-glow";

  return (
    <div className={`vendor-charts ${theme.cssClass} space-y-2`}>
      <div className="vendor-chart-panel vendor-chart-panel--compact vendor-chart-panel--summary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="vendor-chart-title">Neon (consumption)</h3>
          <VendorLiveBadge />
        </div>
        <p className="vendor-chart-meta mt-1">
          {neon.projectName ? `${neon.projectName} · ` : null}
          <span className="font-mono">{neon.projectId}</span>
          {" · "}
          {periodLabel}
        </p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Est. spend" value={neon.estimatedCostFormatted} sub="Launch list rates (estimate)" />
          <StatCard label="Compute" value={neon.computeHours.toFixed(2)} sub="CU-hours" />
          <StatCard
            label="Database size"
            value={`${neon.databaseSizeGb.toFixed(2)} GB`}
            sub={
              neon.databaseSizeAsOf
                ? `root branch · as of ${formatChartDate(neon.databaseSizeAsOf)}`
                : "root branch (primary)"
            }
          />
          <StatCard
            label="Transfer"
            value={`${neon.publicTransferGb.toFixed(3)} GB`}
            sub={
              hasPrivateTransfer
                ? `public · ${neon.privateTransferGb.toFixed(3)} GB private`
                : "public egress"
            }
          />
        </div>
        <p className="vendor-chart-footnote mt-2 leading-snug">
          All branches avg {neon.storageGbAvg.toFixed(2)} GB/day · {neon.storageGbMonths.toFixed(3)} GB-mo billed
          {" · "}
          Storage (GB-mo): root {sb.root.toFixed(3)}
          {hasChildOrSnapshot ? ` · child ${sb.child.toFixed(3)}` : null}
          {sb.instantRestore > 0.001 ? ` · PITR ${sb.instantRestore.toFixed(3)}` : null}
          {sb.snapshot > 0.001 ? ` · snapshots ${sb.snapshot.toFixed(3)}` : null}
          {hasExtraBranches ? ` · extra branches ${neon.extraBranchMonths.toFixed(3)} br-mo` : null}
          {" · "}
          RAM/CPU/connections need Scale+ observability.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <NeonUsageChart title="Compute" subtitle="CU-hours per day">
          <LineChart data={neon.daily} margin={chartMargin}>
            <defs>
              <linearGradient id={gradComputeId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={theme.series.compute} stopOpacity={0.35} />
                <stop offset="100%" stopColor={theme.colors.secondary} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
            <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={formatChartDate}
              formatter={(v: number) => [`${Number(v).toFixed(3)} CU-h`, "Compute"]}
            />
            <Line
              type="monotone"
              dataKey="computeHours"
              stroke={`url(#${gradComputeId})`}
              dot={false}
              strokeWidth={2.5}
              activeDot={{ r: 4, fill: theme.series.compute, stroke: theme.colors.tooltipBg, strokeWidth: 2 }}
            />
          </LineChart>
        </NeonUsageChart>

        <NeonUsageChart title="Storage (total)" subtitle="Daily average GB (all branch types)">
          <LineChart data={neon.daily} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
            <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={formatChartDate}
              formatter={(v: number) => [`${Number(v).toFixed(3)} GB`, "Storage"]}
            />
            <Line
              type="monotone"
              dataKey="storageGbAvg"
              stroke={theme.series.storageTotal}
              dot={false}
              strokeWidth={2.5}
              activeDot={{ r: 4, fill: theme.series.storageTotal, stroke: theme.colors.tooltipBg, strokeWidth: 2 }}
            />
          </LineChart>
        </NeonUsageChart>

        <NeonUsageChart title="Storage breakdown" subtitle="Daily average GB by type (stacked)" height={CHART_HEIGHT_LEGEND}>
          <AreaChart data={neon.daily} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
            <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
            <Tooltip {...tooltipProps} labelFormatter={formatChartDate} />
            <Legend wrapperStyle={legendStyle} iconSize={8} />
            <Area
              type="monotone"
              stackId="storage"
              dataKey="rootStorageGbAvg"
              name="Root"
              fill={theme.series.storageRoot}
              stroke={theme.series.storageRoot}
              fillOpacity={0.65}
            />
            {hasChildOrSnapshot ? (
              <Area
                type="monotone"
                stackId="storage"
                dataKey="childStorageGbAvg"
                name="Child"
                fill={theme.series.storageChild}
                stroke={theme.series.storageChild}
                fillOpacity={0.55}
              />
            ) : null}
            <Area
              type="monotone"
              stackId="storage"
              dataKey="instantRestoreGbAvg"
              name="PITR"
              fill={theme.series.storagePitr}
              stroke={theme.series.storagePitr}
              fillOpacity={0.5}
            />
            {hasChildOrSnapshot ? (
              <Area
                type="monotone"
                stackId="storage"
                dataKey="snapshotStorageGbAvg"
                name="Snapshots"
                fill={theme.series.storageSnapshot}
                stroke={theme.series.storageSnapshot}
                fillOpacity={0.45}
              />
            ) : null}
          </AreaChart>
        </NeonUsageChart>

        <NeonUsageChart title="Public transfer" subtitle="GB egress per day">
          <BarChart data={neon.daily} margin={chartMargin}>
            <defs>
              <linearGradient id={gradPublicId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={theme.series.transferPublic} stopOpacity={0.45} />
                <stop offset="100%" stopColor={theme.colors.secondary} stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
            <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={formatChartDate}
              formatter={(v: number) => [`${Number(v).toFixed(4)} GB`, "Public"]}
            />
            <Bar dataKey="publicTransferGb" fill={`url(#${gradPublicId})`} radius={[3, 3, 0, 0]} />
          </BarChart>
        </NeonUsageChart>

        {hasPrivateTransfer ? (
          <NeonUsageChart title="Private transfer" subtitle="GB per day (PrivateLink, etc.)">
            <BarChart data={neon.daily} margin={chartMargin}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
                <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
                <Tooltip
                  {...tooltipProps}
                  labelFormatter={formatChartDate}
                  formatter={(v: number) => [`${Number(v).toFixed(4)} GB`, "Private"]}
                />
                <Bar dataKey="privateTransferGb" fill={theme.series.transferPrivate} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
              </BarChart>
          </NeonUsageChart>
        ) : null}

        {hasExtraBranches ? (
          <NeonUsageChart title="Extra branches" subtitle="Branch-hours per day (beyond plan allowance)">
            <BarChart data={neon.daily} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={formatChartDate} tick={axisTick} axisLine={{ stroke: theme.colors.grid }} />
              <YAxis tick={axisTick} width={yAxisWidth} axisLine={{ stroke: theme.colors.grid }} />
              <Tooltip
                {...tooltipProps}
                labelFormatter={formatChartDate}
                formatter={(v: number) => [`${Number(v).toFixed(2)} br-h`, "Extra branches"]}
              />
              <Bar dataKey="extraBranchHours" fill={theme.series.extraBranches} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </NeonUsageChart>
        ) : null}
      </div>
    </div>
  );
}
