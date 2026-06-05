"use client";

import type { UserUsageSummary } from "@/lib/subscription";
import { UsagePeriodPanel } from "@/components/subscription/usage-period-panel";
import { useCallback, useEffect, useState } from "react";

type CreditTx = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  note: string | null;
};

type Props = {
  initialUsage: UserUsageSummary;
};

function reasonLabel(reason: string): string {
  if (reason === "PURCHASE") return "Credit pack purchase";
  if (reason === "SPEND_QUERY") return "Question";
  if (reason === "SPEND_IMAGE") return "Image generation";
  if (reason === "ADMIN_ADJUST") return "Admin adjustment";
  return reason;
}

export function AccountUsageSection({ initialUsage }: Props) {
  const [usage] = useState(initialUsage);
  const [transactions, setTransactions] = useState<CreditTx[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const loadCredits = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await fetch("/api/account/credits", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { transactions?: CreditTx[] };
      if (data.transactions) setTransactions(data.transactions);
    } finally {
      setLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  return (
    <div className="space-y-6">
      <UsagePeriodPanel initialUsage={usage} />

      <section
        id="credits"
        className="rounded-xl border border-border bg-bg-surface/90 p-6 shadow-sm"
        aria-labelledby="credits-heading"
      >
        <h2 id="credits-heading" className="text-lg font-semibold text-text-primary">
          Credits & purchase history
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Current balance: <strong className="text-text-primary">{usage.creditBalance}</strong> credits
        </p>
        {loadingTx ? (
          <p className="mt-4 text-sm text-text-muted">Loading history…</p>
        ) : transactions.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No credit transactions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span className="text-text-secondary">
                  {reasonLabel(tx.reason)}
                  {tx.note ? <span className="text-text-muted"> — {tx.note}</span> : null}
                </span>
                <span className={`tabular-nums ${tx.amount >= 0 ? "text-green-400" : "text-text-muted"}`}>
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        {usage.creditPurchasesEnabled ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg-raised"
              onClick={async () => {
                const res = await fetch("/api/billing/portal", { method: "POST" });
                const data = (await res.json()) as { url?: string; error?: string };
                if (data.url) window.location.assign(data.url);
              }}
            >
              Manage subscription
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
