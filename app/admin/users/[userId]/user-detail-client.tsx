"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      allTimeQueries: number;
      allTimeImages: number;
      effectiveLimits: {
        queriesPerMonth: number | null;
        imagesPerMonth: number | null;
        tier: string;
      };
      limitFloors: {
        queriesLimitFloor: number | null;
        imagesLimitFloor: number | null;
        queriesUnlimitedFloor: boolean;
      };
      periodStart: string;
      resetDate: string;
      creditBalance: number;
    };
  creditTransactions: Array<{
    id: string;
    amount: number;
    reason: string;
    bookId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  quotaOverrides: Array<{
    id: string;
    queriesLimit: number | null;
    imagesLimit: number | null;
    expiresAt: string | null;
    reason: string;
    grantedBy: string;
    createdAt: string;
  }>;
  ownedBooks: Array<{
    id: string;
    title: string;
    author: string;
    status: string;
  }>;
  enforcement: {
    accountStatus: string;
    suspendedAt: string | null;
    terminatedAt: string | null;
    statusReason: string | null;
    strikeCount: number;
    pendingAppeal: boolean;
    moderationLogs: Array<{
      id: string;
      source: string;
      aupCategory: string | null;
      summary: string | null;
      createdAt: string;
      flaggedBy: { id: string; username: string | null; email: string } | null;
    }>;
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
  const router = useRouter();
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

  const [editTier, setEditTier] = useState<"free" | "standard" | "premium">("free");
  const [tierBusy, setTierBusy] = useState(false);
  const [overrideQueries, setOverrideQueries] = useState("");
  const [overrideImages, setOverrideImages] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [creditAdjust, setCreditAdjust] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditBusy, setCreditBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [enforcementReason, setEnforcementReason] = useState("");
  const [enforcementBusy, setEnforcementBusy] = useState(false);
  const [enforcementErr, setEnforcementErr] = useState<string | null>(null);
  const [enforcementMsg, setEnforcementMsg] = useState<string | null>(null);

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
      const payload = (await res.json()) as DetailPayload;
      setData(payload);
      if (payload.user.subscriptionTier) {
        setEditTier(payload.user.subscriptionTier as "free" | "standard" | "premium");
      }
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

  async function runEnforcement(
    action: "suspend" | "terminate" | "restore" | "approve_appeal" | "deny_appeal",
  ) {
    setEnforcementErr(null);
    setEnforcementMsg(null);
    setEnforcementBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enforcement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: enforcementReason.trim() || undefined,
          resolutionNote: enforcementReason.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEnforcementErr(body.error ?? "Enforcement action failed");
        return;
      }
      setEnforcementMsg(`Action "${action}" completed.`);
      setEnforcementReason("");
      await load();
    } catch {
      setEnforcementErr("Enforcement action failed");
    } finally {
      setEnforcementBusy(false);
    }
  }

  async function confirmDeleteUser() {
    if (!data) return;
    setDeleteErr(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteErr(body.error ?? "Could not delete user");
        return;
      }
      setDeleteOpen(false);
      router.push("/dashboard?tab=all-users");
      router.refresh();
    } catch {
      setDeleteErr("Could not delete user");
    } finally {
      setDeleteBusy(false);
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

            <p className="mb-3 text-xs text-text-muted">
              All-time: {data.usage.allTimeQueries} queries · {data.usage.allTimeImages} images ·{" "}
              {data.usage.creditBalance} credits
            </p>
            <p className="mb-3 text-xs text-text-muted">
              Grandfathered floors: Q&A{" "}
              {data.usage.limitFloors.queriesUnlimitedFloor
                ? "unlimited"
                : (data.usage.limitFloors.queriesLimitFloor ?? "—")}
              {" · "}images {data.usage.limitFloors.imagesLimitFloor ?? "—"} (global decreases never go below
              these)
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

          {data.user.role === "partner" || data.user.role === "admin" ? (
            <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Partner books
              </h2>
              {data.ownedBooks.length === 0 ? (
                <p className="text-sm text-text-muted">No owned books.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.ownedBooks.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/admin/books/${b.id}`}
                        className="text-accent-text hover:underline"
                      >
                        {b.title}
                      </Link>
                      <span className="text-text-muted"> · {b.author} · {b.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Account enforcement
            </h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">Account status</dt>
                <dd className="font-medium capitalize text-text-primary">
                  {data.enforcement.accountStatus}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Strikes</dt>
                <dd className="text-text-primary">{data.enforcement.strikeCount}</dd>
              </div>
              {data.enforcement.statusReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-text-muted">Status reason</dt>
                  <dd className="text-text-primary">{data.enforcement.statusReason}</dd>
                </div>
              ) : null}
              {data.enforcement.pendingAppeal ? (
                <div className="sm:col-span-2">
                  <dd className="text-sm font-medium text-amber-400">Pending appeal</dd>
                </div>
              ) : null}
            </dl>

            {data.enforcement.moderationLogs.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {data.enforcement.moderationLogs.map((log) => (
                  <li key={log.id} className="rounded border border-border/60 px-3 py-2">
                    <p className="font-medium text-text-primary">
                      {new Date(log.createdAt).toLocaleString()} · {log.source}
                      {log.aupCategory ? ` · ${log.aupCategory}` : ""}
                    </p>
                    {log.summary ? <p className="text-text-muted">{log.summary}</p> : null}
                    {log.flaggedBy ? (
                      <p className="text-xs text-text-muted">
                        Flagged by: {log.flaggedBy.username ?? log.flaggedBy.email}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="mt-4 block text-sm">
              <span className="text-text-muted">Reason / resolution note (optional)</span>
              <input
                type="text"
                value={enforcementReason}
                onChange={(e) => setEnforcementReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                disabled={enforcementBusy}
              />
            </label>
            {enforcementErr ? <p className="mt-2 text-sm text-error">{enforcementErr}</p> : null}
            {enforcementMsg ? <p className="mt-2 text-sm text-success">{enforcementMsg}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {data.enforcement.accountStatus !== "suspended" &&
              data.enforcement.accountStatus !== "terminated" ? (
                <button
                  type="button"
                  disabled={enforcementBusy}
                  onClick={() => void runEnforcement("suspend")}
                  className="rounded-md border border-amber-500/50 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/10"
                >
                  Suspend
                </button>
              ) : null}
              {data.enforcement.accountStatus !== "terminated" ? (
                <button
                  type="button"
                  disabled={enforcementBusy}
                  onClick={() => void runEnforcement("terminate")}
                  className="rounded-md border border-error/50 px-3 py-1.5 text-sm text-error hover:bg-error/10"
                >
                  Terminate
                </button>
              ) : null}
              {data.enforcement.accountStatus === "suspended" ? (
                <button
                  type="button"
                  disabled={enforcementBusy}
                  onClick={() => void runEnforcement("restore")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-base"
                >
                  Restore active
                </button>
              ) : null}
              {data.enforcement.pendingAppeal ? (
                <>
                  <button
                    type="button"
                    disabled={enforcementBusy}
                    onClick={() => void runEnforcement("approve_appeal")}
                    className="rounded-md border border-success/50 px-3 py-1.5 text-sm text-success hover:bg-success/10"
                  >
                    Approve appeal
                  </button>
                  <button
                    type="button"
                    disabled={enforcementBusy}
                    onClick={() => void runEnforcement("deny_appeal")}
                    className="rounded-md border border-error/50 px-3 py-1.5 text-sm text-error hover:bg-error/10"
                  >
                    Deny appeal
                  </button>
                </>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Termination forfeits unused credits via the ledger. Suspension leaves credits untouched.
            </p>
          </section>

          <section className="rounded-lg border border-error/40 bg-bg-surface p-5">
            <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-error">
              Danger zone
            </h2>
            <p className="text-sm text-text-secondary">
              Permanently delete this user, their Clerk account, and all associated data. This cannot
              be undone.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-error/60 px-4 py-2 text-sm font-medium text-error transition hover:bg-error/10"
              onClick={() => {
                setDeleteConfirmEmail("");
                setDeleteErr(null);
                setDeleteOpen(true);
              }}
            >
              Delete user
            </button>
          </section>
        </div>
      ) : null}

      {data && tab === "subscription" ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Subscription tier (admin override)
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Tier
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value as typeof editTier)}
                  className="mt-1 block rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <button
                type="button"
                disabled={tierBusy}
                onClick={async () => {
                  setTierBusy(true);
                  try {
                    await fetch(`/api/admin/users/${userId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ subscriptionTier: editTier }),
                    });
                    await load();
                  } finally {
                    setTierBusy(false);
                  }
                }}
                className="rounded-md bg-accent px-3 py-2 text-sm text-bg-base"
              >
                Save tier
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Quota override
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Queries limit (blank = tier default)
                <input
                  className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                  value={overrideQueries}
                  onChange={(e) => setOverrideQueries(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Images limit (blank = tier default)
                <input
                  className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                  value={overrideImages}
                  onChange={(e) => setOverrideImages(e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Reason
                <input
                  className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={overrideBusy}
              className="mt-3 rounded-md border border-border px-3 py-2 text-sm"
              onClick={async () => {
                setOverrideBusy(true);
                try {
                  const q = overrideQueries.trim();
                  const i = overrideImages.trim();
                  await fetch(`/api/admin/users/${userId}/quota-overrides`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      queriesLimit: q === "" ? null : Number.parseInt(q, 10),
                      imagesLimit: i === "" ? null : Number.parseInt(i, 10),
                      reason: overrideReason.trim(),
                    }),
                  });
                  setOverrideReason("");
                  await load();
                } finally {
                  setOverrideBusy(false);
                }
              }}
            >
              Add override
            </button>
            {data.quotaOverrides.length > 0 ? (
              <ul className="mt-4 space-y-2 text-xs text-text-muted">
                {data.quotaOverrides.map((o) => (
                  <li key={o.id}>
                    Q: {o.queriesLimit ?? "default"} · Img: {o.imagesLimit ?? "default"} — {o.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Credits ({data.usage.creditBalance} balance)
            </h2>
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                placeholder="Amount (+/-)"
                value={creditAdjust}
                onChange={(e) => setCreditAdjust(e.target.value)}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
              />
              <input
                placeholder="Note"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                className="min-w-[12rem] flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={creditBusy}
                className="rounded-md bg-accent px-3 py-2 text-sm text-bg-base"
                onClick={async () => {
                  setCreditBusy(true);
                  try {
                    await fetch(`/api/admin/users/${userId}/credits`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amount: Number.parseInt(creditAdjust, 10),
                        note: creditNote.trim(),
                      }),
                    });
                    setCreditAdjust("");
                    setCreditNote("");
                    await load();
                  } finally {
                    setCreditBusy(false);
                  }
                }}
              >
                Adjust credits
              </button>
            </div>
            {data.creditTransactions.length > 0 ? (
              <ul className="mt-4 max-h-48 overflow-y-auto text-xs text-text-muted">
                {data.creditTransactions.map((t) => (
                  <li key={t.id} className="flex justify-between py-1">
                    <span>
                      {t.reason} {t.note ? `— ${t.note}` : ""}
                    </span>
                    <span className={t.amount >= 0 ? "text-green-400" : ""}>
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

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

      {deleteOpen && data ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => (deleteBusy ? null : setDeleteOpen(false))}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-user-title"
            className="max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-delete-user-title" className="text-lg font-semibold text-text-primary">
              Delete user permanently?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              This removes <span className="font-medium text-text-primary">{data.user.email}</span> from
              Clerk and deletes all of their NovelViz data. Type their email to confirm.
            </p>
            {data.enforcement.accountStatus !== "active" ? (
              <p className="mt-2 text-sm leading-relaxed text-amber-400/90">
                This account is {data.enforcement.accountStatus} for enforcement. Deleting will remove
                the ban and free this email for a new registration. Use this to reset test accounts.
              </p>
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="text-text-muted">Email confirmation</span>
              <input
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
                placeholder={data.user.email}
                autoComplete="off"
                disabled={deleteBusy}
              />
            </label>
            {deleteErr ? (
              <p className="mt-3 text-sm text-error" role="alert">
                {deleteErr}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-base"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-error px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-error/90 disabled:opacity-60"
                disabled={
                  deleteBusy ||
                  deleteConfirmEmail.trim().toLowerCase() !== data.user.email.toLowerCase()
                }
                onClick={() => void confirmDeleteUser()}
              >
                {deleteBusy ? "Deleting…" : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
