"use client";

import Link from "next/link";

export type QuotaExhaustedPayload = {
  limitType?: string;
  used?: number;
  limit?: number | null;
  resetDate?: string;
  creditBalance?: number;
  creditCost?: number;
  tier?: string;
  creditPurchasesEnabled?: boolean;
};

type Props = {
  open: boolean;
  payload: QuotaExhaustedPayload | null;
  onClose: () => void;
};

function formatReset(resetDate?: string): string {
  if (!resetDate) return "at the start of your next billing period";
  const days = Math.max(
    0,
    Math.ceil((new Date(resetDate).getTime() - Date.now()) / 86_400_000),
  );
  const datePart = new Date(resetDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (days === 0) return `when your plan renews today (${datePart})`;
  if (days === 1) return `when your plan renews tomorrow (${datePart})`;
  return `in ${days} days (${datePart})`;
}

export function QuotaExhaustedModal({ open, payload, onClose }: Props) {
  if (!open || !payload) return null;

  const label = payload.limitType === "query" ? "questions" : "image generations";
  const tierLabel = payload.tier
    ? payload.tier.charAt(0).toUpperCase() + payload.tier.slice(1)
    : "your plan";
  const limit = payload.limit ?? 0;
  const used = payload.used ?? limit;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-xl">
        <h2 id="quota-modal-title" className="text-lg font-semibold text-text-primary">
          Monthly allowance used
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          You&apos;ve used <strong>{used}</strong> of <strong>{limit}</strong> {label} on your{" "}
          <strong>{tierLabel}</strong> plan this month. Your allowance resets {formatReset(payload.resetDate)}.
        </p>
        {payload.creditBalance != null && payload.creditBalance > 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            You have {payload.creditBalance} credits — each {label.slice(0, -1)} costs{" "}
            {payload.creditCost ?? 1} credit(s) after your monthly quota is used.
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/onboarding/plan"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-base no-underline"
            onClick={onClose}
          >
            View plans & upgrade
          </Link>
          {payload.creditPurchasesEnabled ? (
            <Link
              href="/account#credits"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary no-underline hover:bg-bg-raised"
              onClick={onClose}
            >
              Buy credit packs
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-raised"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
