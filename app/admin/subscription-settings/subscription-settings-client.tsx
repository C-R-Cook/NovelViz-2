"use client";

import type { CreditPack, TierLimitConfig } from "@db";
import { useCallback, useState } from "react";

type TierRow = TierLimitConfig;
type PackRow = CreditPack;

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25";

function formatLimit(v: number | null): string {
  return v === null ? "" : String(v);
}

function parseLimit(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || t.toLowerCase() === "unlimited") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function TierEditor({ tier, onSaved }: { tier: TierRow; onSaved: (t: TierRow) => void }) {
  const [queries, setQueries] = useState(formatLimit(tier.queriesPerMonth));
  const [images, setImages] = useState(formatLimit(tier.imagesPerMonth));
  const [models, setModels] = useState(tier.allowedModels.join("\n"));
  const [creditPurchases, setCreditPurchases] = useState(tier.creditPurchasesEnabled);
  const [costQuery, setCostQuery] = useState(String(tier.creditCostQuery));
  const [costImage, setCostImage] = useState(String(tier.creditCostImage));
  const [displayPrice, setDisplayPrice] = useState(tier.displayPriceMonthly ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const res = await fetch("/api/admin/subscription-config/tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tier.tier,
          queriesPerMonth: parseLimit(queries),
          imagesPerMonth: parseLimit(images),
          allowedModels: models.split("\n").map((m) => m.trim()).filter(Boolean),
          creditPurchasesEnabled: creditPurchases,
          creditCostQuery: Number.parseInt(costQuery, 10),
          creditCostImage: Number.parseInt(costImage, 10),
          displayPriceMonthly: displayPrice.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; tier?: TierRow };
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.tier) onSaved(data.tier);
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [tier.tier, queries, images, models, creditPurchases, costQuery, costImage, displayPrice, onSaved]);

  return (
    <div className="rounded-xl border border-border bg-bg-surface/90 p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold capitalize text-text-primary">{tier.tier}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text-muted">Q&A / month (blank = unlimited)</span>
          <input className={inputClass} value={queries} onChange={(e) => setQueries(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-text-muted">Images / month (blank = unlimited)</span>
          <input className={inputClass} value={images} onChange={(e) => setImages(e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-text-muted">Allowed models (one per line)</span>
          <textarea className={`${inputClass} font-mono text-xs`} rows={3} value={models} onChange={(e) => setModels(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-text-muted">Credit cost per query</span>
          <input className={inputClass} type="number" min={1} value={costQuery} onChange={(e) => setCostQuery(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-text-muted">Credit cost per image</span>
          <input className={inputClass} type="number" min={1} value={costImage} onChange={(e) => setCostImage(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-text-muted">Display price (marketing)</span>
          <input className={inputClass} value={displayPrice} onChange={(e) => setDisplayPrice(e.target.value)} placeholder="e.g. $5/mo" />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={creditPurchases} onChange={(e) => setCreditPurchases(e.target.checked)} />
          <span>Allow credit pack purchases on this tier</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save tier"}
        </button>
        {ok ? <span className="text-sm text-green-400">Saved</span> : null}
        {err ? <span className="text-sm text-error">{err}</span> : null}
      </div>
    </div>
  );
}

function PackEditor({
  pack,
  onUpdate,
  onDelete,
}: {
  pack: PackRow;
  onUpdate: (p: PackRow) => void;
  onDelete: (id: string) => void;
}) {
  const [state, setState] = useState(pack);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/subscription-config/credit-packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = (await res.json()) as { pack?: PackRow; error?: string };
      if (!res.ok) throw new Error(data.error);
      if (data.pack) onUpdate(data.pack);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-base/50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Name
          <input className={inputClass} value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
        </label>
        <label className="text-sm">
          Credits
          <input className={inputClass} type="number" min={1} value={state.credits} onChange={(e) => setState((s) => ({ ...s, credits: Number(e.target.value) }))} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={state.active} onChange={(e) => setState((s) => ({ ...s, active: e.target.checked }))} />
          Active
        </label>
        <label className="text-sm">
          Price free (cents)
          <input className={inputClass} type="number" min={0} value={state.priceFree} onChange={(e) => setState((s) => ({ ...s, priceFree: Number(e.target.value) }))} />
        </label>
        <label className="text-sm">
          Price standard (cents)
          <input className={inputClass} type="number" min={0} value={state.priceStandard} onChange={(e) => setState((s) => ({ ...s, priceStandard: Number(e.target.value) }))} />
        </label>
        <label className="text-sm">
          Price premium (cents)
          <input className={inputClass} type="number" min={0} value={state.pricePremium} onChange={(e) => setState((s) => ({ ...s, pricePremium: Number(e.target.value) }))} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-raised">
          Save pack
        </button>
        <button type="button" onClick={() => onDelete(pack.id)} className="rounded-md border border-error/40 px-3 py-1.5 text-xs text-error hover:bg-error/10">
          Delete
        </button>
      </div>
    </div>
  );
}

type FailureRow = {
  id: string;
  route: string;
  errorSummary: string;
  userEmail: string;
  createdAt: string;
};

export function SubscriptionSettingsClient({
  initialTiers,
  initialPacks,
  recentFailures = [],
}: {
  initialTiers: TierRow[];
  initialPacks: PackRow[];
  recentFailures?: FailureRow[];
}) {
  const [tiers, setTiers] = useState(initialTiers);
  const [packs, setPacks] = useState(initialPacks);
  const [newPackName, setNewPackName] = useState("");
  const [newPackCredits, setNewPackCredits] = useState("100");

  async function addPack() {
    const res = await fetch("/api/admin/subscription-config/credit-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPackName.trim(), credits: Number.parseInt(newPackCredits, 10) }),
    });
    const data = (await res.json()) as { pack?: PackRow; error?: string };
    if (res.ok && data.pack) {
      setPacks((p) => [...p, data.pack!]);
      setNewPackName("");
    }
  }

  async function deletePack(id: string) {
    await fetch(`/api/admin/subscription-config/credit-packs/${id}`, { method: "DELETE" });
    setPacks((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Tier limits</h2>
        {tiers.map((tier) => (
          <TierEditor
            key={tier.tier}
            tier={tier}
            onSaved={(t) => setTiers((all) => all.map((x) => (x.tier === t.tier ? t : x)))}
          />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Credit packs</h2>
        {packs.map((pack) => (
          <PackEditor
            key={pack.id}
            pack={pack}
            onUpdate={(p) => setPacks((all) => all.map((x) => (x.id === p.id ? p : x)))}
            onDelete={deletePack}
          />
        ))}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
          <label className="text-sm">
            New pack name
            <input className={inputClass} value={newPackName} onChange={(e) => setNewPackName(e.target.value)} />
          </label>
          <label className="text-sm">
            Credits
            <input className={inputClass} type="number" min={1} value={newPackCredits} onChange={(e) => setNewPackCredits(e.target.value)} />
          </label>
          <button type="button" onClick={() => void addPack()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg-base">
            Add pack
          </button>
        </div>
      </section>

      {recentFailures.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Recent AI service failures
          </h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-bg-surface/90 p-4 text-xs">
            {recentFailures.map((f) => (
              <li key={f.id} className="border-b border-border/50 pb-2 last:border-0">
                <span className="font-mono text-text-muted">{f.route}</span>
                <span className="text-text-muted"> · {f.userEmail}</span>
                <p className="mt-1 text-text-secondary line-clamp-2">{f.errorSummary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
