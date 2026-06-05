"use client";

import type { UserUsageSummary } from "@/lib/subscription";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialUsage: UserUsageSummary;
  /** Increment to refetch usage (e.g. after generating an image). */
  refreshKey?: number;
  variant?: "full" | "compact";
  className?: string;
};

function formatRenewal(days: number, resetDateIso: string): string {
  const reset = new Date(resetDateIso);
  const datePart = reset.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (days === 0) return `Renews today (${datePart})`;
  if (days === 1) return `Renews tomorrow (${datePart})`;
  return `Renews in ${days} days (${datePart})`;
}

function formatLimit(used: number, limit: number | null): string {
  if (limit === null) return `${used} used · unlimited`;
  return `${used} / ${limit} used`;
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function UsageBar({
  label,
  meter,
  accentClass = "bg-accent",
}: {
  label: string;
  meter: UserUsageSummary["images"];
  accentClass?: string;
}) {
  const atLimit = !meter.unlimited && meter.limit !== null && meter.used >= meter.limit;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className={`text-xs tabular-nums ${atLimit ? "text-error" : "text-text-muted"}`}>
          {formatLimit(meter.used, meter.limit)}
        </span>
      </div>
      {meter.unlimited ? (
        <p className="text-xs text-text-muted">Unlimited on your plan</p>
      ) : (
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-bg-raised ring-1 ring-border/60"
          role="progressbar"
          aria-valuenow={meter.percentUsed ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} usage`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${atLimit ? "bg-error/80" : accentClass}`}
            style={{ width: `${meter.percentUsed ?? 0}%` }}
          />
        </div>
      )}
      {meter.creditBalance > 0 ? (
        <p className="text-xs text-text-muted">{meter.creditBalance} credits available</p>
      ) : null}
    </div>
  );
}

export function UsagePeriodPanel({
  initialUsage,
  refreshKey = 0,
  variant = "full",
  className = "",
}: Props) {
  const [usage, setUsage] = useState(initialUsage);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/account/usage", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { usage?: UserUsageSummary };
      if (data.usage) setUsage(data.usage);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setUsage(initialUsage);
  }, [initialUsage]);

  useEffect(() => {
    if (refreshKey > 0) void refresh();
  }, [refreshKey, refresh]);

  const renewal = formatRenewal(usage.daysUntilRenewal, usage.resetDate);
  const compact = variant === "compact";

  return (
    <section
      className={`rounded-xl border border-border bg-bg-surface/90 ${compact ? "px-3 py-3" : "p-5 shadow-sm"} ${className}`.trim()}
      aria-labelledby={compact ? undefined : "usage-period-heading"}
    >
      <div className={`flex flex-wrap items-start justify-between gap-2 ${compact ? "mb-2" : "mb-4"}`}>
        <div>
          {!compact ? (
            <h2 id="usage-period-heading" className="text-lg font-semibold text-text-primary">
              Monthly usage
            </h2>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">This month</p>
          )}
          <p className={`${compact ? "text-xs" : "text-sm"} text-text-muted`}>
            Billing cycle starts day {usage.billingAnchorDay} each month · {renewal}
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full border border-border bg-bg-base px-2.5 py-0.5 text-xs font-medium capitalize text-text-primary">
            {tierLabel(usage.tier)}
          </span>
          {refreshing ? (
            <span className="text-[10px] text-text-muted" aria-live="polite">
              Updating…
            </span>
          ) : null}
        </span>
      </div>

      {usage.betaMode ? (
        <p
          className={`mb-3 rounded-md border border-amber-400/35 bg-amber-400/10 text-amber-200/90 ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
        >
          Beta mode — usage is shown for monitoring; limits are not enforced yet.
        </p>
      ) : null}

      <div className={compact ? "space-y-3" : "space-y-5"}>
        <UsageBar label="Images generated" meter={usage.images} accentClass="bg-accent" />
        <UsageBar label="Questions asked" meter={usage.queries} accentClass="bg-highlight/80" />
      </div>
    </section>
  );
}

export function bumpUsageMeter(
  usage: UserUsageSummary,
  type: "query" | "image",
): UserUsageSummary {
  const key = type === "query" ? "queries" : "images";
  const meter = usage[key];
  const used = meter.used + 1;
  const unlimited = meter.limit === null;
  const percentUsed =
    unlimited || meter.limit === null || meter.limit <= 0
      ? null
      : Math.min(100, Math.round((used / meter.limit) * 100));
  return {
    ...usage,
    [key]: { ...meter, used, percentUsed, creditBalance: meter.creditBalance },
  };
}

export function formatLimitReachedMessage(data: {
  limitType?: string;
  used?: number;
  limit?: number | null;
  resetDate?: string;
}): string {
  const label = data.limitType === "query" ? "questions" : "images";
  const limit = data.limit ?? 0;
  const used = data.used ?? limit;
  let when = "at the start of your next billing period";
  if (data.resetDate) {
    const days = Math.max(
      0,
      Math.ceil((new Date(data.resetDate).getTime() - Date.now()) / 86_400_000),
    );
    when =
      days === 0
        ? "when your plan renews today"
        : days === 1
          ? "when your plan renews tomorrow"
          : `in ${days} days (${new Date(data.resetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })})`;
  }
  return `You've used ${used} of ${limit} ${label} this month. Your allowance resets ${when}.`;
}
