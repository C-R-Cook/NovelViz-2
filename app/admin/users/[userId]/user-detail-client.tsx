"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GrantRow = {
  id: string;
  grantType: string;
  source: string;
  tierValue: string | null;
  bonusAmount: number | null;
  usedAmount: number;
  startsAt: string;
  expiresAt: string | null;
  reason: string | null;
  grantedBy: string;
};

type BadgeRow = {
  badgeKey: string;
  name: string;
  description: string;
  awarded: boolean;
  awardedAt?: string;
  awardedBy?: string;
  note?: string;
};

type DetailPayload = {
  user: {
    id: string;
    clerkId: string;
    username: string | null;
    name: string | null;
    email: string;
    role: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
    usagePeriodAnchor: number;
    createdAt: string;
  };
  activeGrants: GrantRow[];
  allBadges: BadgeRow[];
  usage: {
    queriesThisPeriod: number;
    imagesThisPeriod: number;
    effectiveLimits: {
      queriesPerMonth: number | null;
      imagesPerMonth: number | null;
      tier: string;
    };
    periodStart: string;
    resetDate: string;
  };
};

type Tab = "account" | "subscription" | "badges";
type GrantTypeValue = "TIER_UPGRADE" | "QUERY_BONUS" | "IMAGE_BONUS";
type DurationMode = "permanent" | "custom";

function limitLabel(used: number, limit: number | null): string {
  return `${used} / ${limit === null ? "∞" : limit}`;
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) return null;
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
      <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function grantTypeLabel(type: string): string {
  if (type === "TIER_UPGRADE") return "Tier upgrade";
  if (type === "QUERY_BONUS") return "Query bonus";
  if (type === "IMAGE_BONUS") return "Image bonus";
  return type;
}

function grantValueLabel(g: GrantRow): string {
  if (g.grantType === "TIER_UPGRADE") return g.tierValue ?? "—";
  if (g.bonusAmount != null) return `+${g.bonusAmount} (used ${g.usedAmount})`;
  return "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "Permanent";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tierBadgeClass(tier: string): string {
  if (tier === "premium") return "bg-highlight-dim text-highlight";
  if (tier === "standard") return "bg-accent-muted text-accent-text";
  return "bg-bg-raised text-text-muted";
}

function statusTextClass(status: string): string {
  if (status === "active") return "text-success";
  if (status === "past_due") return "text-amber-400";
  if (status === "cancelled") return "text-error";
  if (status === "trialing") return "text-accent-text";
  return "text-text-muted";
}

export function UserDetailClient({ userId, betaMode }: { userId: string; betaMode: boolean }) {
  const [tab, setTab] = useState<Tab>("account");
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [grantType, setGrantType] = useState<GrantTypeValue>("TIER_UPGRADE");
  const [tierValue, setTierValue] = useState<"free" | "standard" | "premium">("standard");
  const [bonusAmount, setBonusAmount] = useState("100");
  const [durationMode, setDurationMode] = useState<DurationMode>("permanent");
  const [expiresAt, setExpiresAt] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantMsg, setGrantMsg] = useState<string | null>(null);
  const [grantErr, setGrantErr] = useState<string | null>(null);

  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [badgeConfirmKey, setBadgeConfirmKey] = useState<string | null>(null);
  const [badgeConfirmAction, setBadgeConfirmAction] = useState<"award" | "revoke" | null>(null);
  const [badgeNote, setBadgeNote] = useState("");
  const [badgeBusy, setBadgeBusy] = useState(false);
  const [badgeErr, setBadgeErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to load user");
        setData(null);
        return;
      }
      setData((await res.json()) as DetailPayload);
    } catch {
      setError("Failed to load user");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitGrant() {
    const reason = grantReason.trim();
    if (!reason) {
      setGrantErr("Reason is required");
      return;
    }

    const payload: Record<string, unknown> = {
      grantType,
      reason,
    };

    if (grantType === "TIER_UPGRADE") {
      payload.tierValue = tierValue;
    } else {
      const amt = Number.parseInt(bonusAmount, 10);
      if (!Number.isFinite(amt) || amt < 1) {
        setGrantErr("Bonus amount must be a positive integer");
        return;
      }
      payload.bonusAmount = amt;
    }

    if (durationMode === "custom") {
      if (!expiresAt) {
        setGrantErr("Expiry date is required for custom duration");
        return;
      }
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        setGrantErr("Invalid expiry date");
        return;
      }
      payload.expiresAt = parsed.toISOString();
    }

    setGrantBusy(true);
    setGrantErr(null);
    setGrantMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGrantErr(body.error ?? "Failed to create grant");
        return;
      }
      setGrantReason("");
      setGrantMsg("Grant created");
      await load();
    } catch {
      setGrantErr("Failed to create grant");
    } finally {
      setGrantBusy(false);
    }
  }

  async function revokeGrant(grantId: string) {
    setRevokeBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/grants/${grantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to revoke grant");
        return;
      }
      setRevokeConfirmId(null);
      await load();
    } catch {
      setError("Failed to revoke grant");
    } finally {
      setRevokeBusy(false);
    }
  }

  async function confirmBadgeAction(badgeKey: string) {
    setBadgeBusy(true);
    setBadgeErr(null);
    try {
      if (badgeConfirmAction === "award") {
        const res = await fetch(`/api/admin/users/${userId}/badges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badgeKey,
            note: badgeNote.trim() || undefined,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setBadgeErr(body.error ?? "Failed to award badge");
          return;
        }
      } else {
        const res = await fetch(
          `/api/admin/users/${userId}/badges/${encodeURIComponent(badgeKey)}`,
          { method: "DELETE" },
        );
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setBadgeErr(body.error ?? "Failed to revoke badge");
          return;
        }
      }
      setBadgeConfirmKey(null);
      setBadgeConfirmAction(null);
      setBadgeNote("");
      await load();
    } catch {
      setBadgeErr("Badge action failed");
    } finally {
      setBadgeBusy(false);
    }
  }

  function openBadgeConfirm(key: string, action: "award" | "revoke") {
    setBadgeErr(null);
    setBadgeNote("");
    setBadgeConfirmKey(key);
    setBadgeConfirmAction(action);
  }

  const displayName =
    data?.user.username || data?.user.name || data?.user.email || "User";

  const tabs: { id: Tab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "subscription", label: "Subscription" },
    { id: "badges", label: "Badges" },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Link href="/admin/users" className="hover:text-accent-text hover:underline">
          All users
        </Link>
        <span aria-hidden>/</span>
        <span className="text-text-primary">{loading ? "…" : displayName}</span>
      </nav>

      {betaMode ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          Beta mode is on — usage limits are shown but not enforced for end users.
        </div>
      ) : null}

      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">User management</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {loading ? "Loading…" : displayName}
        </h1>
        {data?.user.email ? (
          <p className="text-sm text-text-secondary">{data.user.email}</p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-b-2 border-accent text-accent-text"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {loading && !data ? (
        <p className="text-sm text-text-muted">Loading user details…</p>
      ) : null}

      {data && tab === "account" ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">User info</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">Email</dt>
                <dd className="text-text-primary">{data.user.email}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Username</dt>
                <dd className="text-text-primary">{data.user.username ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Name</dt>
                <dd className="text-text-primary">{data.user.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Role</dt>
                <dd className="font-mono text-xs text-accent-text">{data.user.role}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Clerk ID</dt>
                <dd className="break-all font-mono text-xs text-text-secondary">{data.user.clerkId}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Internal ID</dt>
                <dd className="break-all font-mono text-xs text-text-secondary">{data.user.id}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Tier</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierBadgeClass(data.user.subscriptionTier)}`}
                  >
                    {data.user.subscriptionTier}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Status</dt>
                <dd className={`capitalize ${statusTextClass(data.user.subscriptionStatus)}`}>
                  {data.user.subscriptionStatus.replace("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Stripe customer</dt>
                <dd className="font-mono text-xs text-text-secondary">
                  {data.user.stripeCustomerId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Joined</dt>
                <dd className="text-text-primary">
                  {new Date(data.user.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Usage anchor day</dt>
                <dd className="text-text-primary">{data.user.usagePeriodAnchor}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">Usage</h2>
            <p className="mb-4 text-xs text-text-muted">
              Effective tier:{" "}
              <span className="capitalize text-accent-text">{data.usage.effectiveLimits.tier}</span>
              {" · "}
              Period resets{" "}
              {new Date(data.usage.resetDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            <div className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-text-secondary">Queries this period</span>
                  <span className="font-mono text-text-primary">
                    {limitLabel(data.usage.queriesThisPeriod, data.usage.effectiveLimits.queriesPerMonth)}
                  </span>
                </div>
                <UsageBar
                  used={data.usage.queriesThisPeriod}
                  limit={data.usage.effectiveLimits.queriesPerMonth}
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-text-secondary">Images this period</span>
                  <span className="font-mono text-text-primary">
                    {limitLabel(data.usage.imagesThisPeriod, data.usage.effectiveLimits.imagesPerMonth)}
                  </span>
                </div>
                <UsageBar
                  used={data.usage.imagesThisPeriod}
                  limit={data.usage.effectiveLimits.imagesPerMonth}
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {data && tab === "subscription" ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-border-subtle">
            <h2 className="border-b border-border-subtle bg-bg-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Active grants
            </h2>
            {data.activeGrants.length === 0 ? (
              <p className="md:hidden px-4 py-8 text-center text-sm text-text-muted">No active grants.</p>
            ) : (
              <ul className="md:hidden divide-y divide-border-subtle">
                {data.activeGrants.map((g) => (
                  <li key={g.id} className="space-y-2 px-4 py-4">
                    <p className="font-medium text-text-primary">{grantTypeLabel(g.grantType)}</p>
                    <p className="text-sm capitalize text-text-secondary">{grantValueLabel(g)}</p>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-text-muted">Source</dt>
                        <dd className="font-mono text-text-muted">{g.source}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Expires</dt>
                        <dd className="text-text-muted">{formatDate(g.expiresAt)}</dd>
                      </div>
                    </dl>
                    {g.reason ? (
                      <p className="text-xs text-text-secondary">{g.reason}</p>
                    ) : null}
                    {revokeConfirmId === g.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={revokeBusy}
                          onClick={() => void revokeGrant(g.id)}
                          className="rounded-md bg-error/20 px-3 py-2 text-xs text-error"
                        >
                          Confirm revoke
                        </button>
                        <button
                          type="button"
                          disabled={revokeBusy}
                          onClick={() => setRevokeConfirmId(null)}
                          className="rounded-md border border-border px-3 py-2 text-xs text-text-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevokeConfirmId(g.id)}
                        className="text-xs text-error underline-offset-2 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Starts</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.activeGrants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-text-muted">
                      No active grants.
                    </td>
                  </tr>
                ) : (
                  data.activeGrants.map((g) => (
                    <tr key={g.id} className="border-b border-border-subtle/80 last:border-0">
                      <td className="px-3 py-2.5 text-text-primary">{grantTypeLabel(g.grantType)}</td>
                      <td className="px-3 py-2.5 capitalize text-text-secondary">{grantValueLabel(g)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-muted">{g.source}</td>
                      <td className="px-3 py-2.5 text-xs text-text-muted">{formatDate(g.startsAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-text-muted">{formatDate(g.expiresAt)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-text-secondary" title={g.reason ?? undefined}>
                        {g.reason ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {revokeConfirmId === g.id ? (
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-amber-400">Revoke this grant?</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={revokeBusy}
                                onClick={() => void revokeGrant(g.id)}
                                className="rounded-md bg-error/20 px-2 py-1 text-xs text-error hover:bg-error/30 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                disabled={revokeBusy}
                                onClick={() => setRevokeConfirmId(null)}
                                className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRevokeConfirmId(g.id)}
                            className="text-xs text-error underline-offset-2 hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">Add grant</h2>
            <div className="grid max-w-xl gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-text-muted">Grant type</span>
                <select
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value as GrantTypeValue)}
                  className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <option value="TIER_UPGRADE">Tier upgrade</option>
                  <option value="QUERY_BONUS">Query bonus</option>
                  <option value="IMAGE_BONUS">Image bonus</option>
                </select>
              </label>

              {grantType === "TIER_UPGRADE" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-muted">Tier</span>
                  <select
                    value={tierValue}
                    onChange={(e) => setTierValue(e.target.value as "free" | "standard" | "premium")}
                    className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <option value="free">Free</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-muted">Bonus amount</span>
                  <input
                    type="number"
                    min={1}
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  />
                </label>
              )}

              <fieldset className="text-sm">
                <legend className="mb-2 text-text-muted">Duration</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-text-primary">
                    <input
                      type="radio"
                      name="duration"
                      checked={durationMode === "permanent"}
                      onChange={() => setDurationMode("permanent")}
                    />
                    Permanent
                  </label>
                  <label className="flex items-center gap-2 text-text-primary">
                    <input
                      type="radio"
                      name="duration"
                      checked={durationMode === "custom"}
                      onChange={() => setDurationMode("custom")}
                    />
                    Custom expiry
                  </label>
                </div>
              </fieldset>

              {durationMode === "custom" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-muted">Expires at</span>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block text-text-muted">Reason (required)</span>
                <textarea
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
              </label>

              {grantErr ? <p className="text-sm text-error">{grantErr}</p> : null}
              {grantMsg ? <p className="text-sm text-success">{grantMsg}</p> : null}

              <div>
                <button
                  type="button"
                  disabled={grantBusy}
                  onClick={() => void submitGrant()}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base hover:bg-accent/90 disabled:opacity-50"
                >
                  {grantBusy ? "Creating…" : "Create grant"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {data && tab === "badges" ? (
        <div className="space-y-4">
          {badgeErr ? <p className="text-sm text-error">{badgeErr}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.allBadges.map((b) => (
              <article
                key={b.badgeKey}
                className={`rounded-lg border p-4 ${
                  b.awarded
                    ? "border-accent/40 bg-accent-muted/30"
                    : "border-border-subtle bg-bg-surface"
                }`}
              >
                <h3 className="font-medium text-text-primary">{b.name}</h3>
                <p className="mt-1 text-xs text-text-muted">{b.badgeKey}</p>
                <p className="mt-2 text-sm text-text-secondary">{b.description}</p>
                {b.awarded && b.awardedAt ? (
                  <p className="mt-3 text-xs text-text-muted">
                    Awarded {new Date(b.awardedAt).toLocaleDateString()}
                    {b.awardedBy ? ` · by ${b.awardedBy}` : ""}
                    {b.note ? ` · ${b.note}` : ""}
                  </p>
                ) : null}

                <div className="mt-4">
                  {badgeConfirmKey === b.badgeKey ? (
                    <div className="space-y-2 rounded-md border border-border-subtle bg-bg-base p-3">
                      <p className="text-xs text-amber-400">
                        {badgeConfirmAction === "award" ? "Award this badge?" : "Revoke this badge?"}
                      </p>
                      {badgeConfirmAction === "award" ? (
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={badgeNote}
                          onChange={(e) => setBadgeNote(e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        />
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={badgeBusy}
                          onClick={() => void confirmBadgeAction(b.badgeKey)}
                          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-bg-base disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={badgeBusy}
                          onClick={() => {
                            setBadgeConfirmKey(null);
                            setBadgeConfirmAction(null);
                            setBadgeNote("");
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : b.awarded ? (
                    <button
                      type="button"
                      onClick={() => openBadgeConfirm(b.badgeKey, "revoke")}
                      className="text-xs text-error underline-offset-2 hover:underline"
                    >
                      Revoke badge
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openBadgeConfirm(b.badgeKey, "award")}
                      className="text-xs text-accent-text underline-offset-2 hover:underline"
                    >
                      Award badge
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
