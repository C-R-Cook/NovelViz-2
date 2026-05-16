"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  clerkId: string;
  username: string;
  name: string;
  email: string;
  role: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  createdAt: string;
  hasOgBadge: boolean;
};

type SortField = "createdAt" | "email" | "username" | "subscriptionTier" | "name";

function tierBadgeClass(tier: string): string {
  if (tier === "premium") return "bg-highlight-dim text-highlight";
  if (tier === "standard") return "bg-accent-muted text-accent-text";
  return "bg-bg-raised text-text-muted";
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "text-success";
  if (status === "past_due") return "text-amber-400";
  if (status === "cancelled") return "text-error";
  if (status === "trialing") return "text-accent-text";
  return "text-text-muted";
}

export function UsersAdminClient({ variant = "page" }: { variant?: "page" | "embedded" }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, order]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        page: String(page),
        sort,
        order,
      });
      if (debouncedSearch) sp.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/users?${sp.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to load users");
        return;
      }
      const data = (await res.json()) as {
        users: UserRow[];
        total: number;
        pageSize: number;
      };
      setUsers(data.users);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(field: SortField) {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
  }

  const sortIndicator = useMemo(
    () => (field: SortField) => (sort === field ? (order === "asc" ? " ↑" : " ↓") : ""),
    [sort, order],
  );

  const rootClass =
    variant === "embedded" ? "space-y-4" : "admin-users-root relative space-y-6";

  return (
    <div className={rootClass}>
      {variant === "page" ? (
        <header className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">User management</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">All Users</h1>
        </header>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, username, email…"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle font-mono text-[10px] uppercase tracking-widest text-text-muted">
              <th className="px-3 py-2">
                <button type="button" onClick={() => toggleSort("email")} className="hover:text-text-primary">
                  Email{sortIndicator("email")}
                </button>
              </th>
              <th className="px-3 py-2">
                <button type="button" onClick={() => toggleSort("username")} className="hover:text-text-primary">
                  User{sortIndicator("username")}
                </button>
              </th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("subscriptionTier")}
                  className="hover:text-text-primary"
                >
                  Tier{sortIndicator("subscriptionTier")}
                </button>
              </th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">
                <button type="button" onClick={() => toggleSort("createdAt")} className="hover:text-text-primary">
                  Joined{sortIndicator("createdAt")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border-subtle/80 transition hover:-translate-y-0.5 hover:bg-bg-hover last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/users/${u.id}`} className="block text-text-secondary hover:text-accent-text">
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="block font-medium text-text-primary hover:text-accent-text"
                    >
                      {u.username || u.name || "—"}
                      {u.hasOgBadge ? (
                        <span className="ml-2 inline-flex rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          ★ OG
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-accent-text/90">{u.role}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierBadgeClass(u.subscriptionTier)}`}
                    >
                      {u.subscriptionTier}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 text-xs capitalize ${statusBadgeClass(u.subscriptionStatus)}`}>
                    {u.subscriptionStatus.replace("_", " ")}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
        <span>
          Page {page} of {totalPages} ({total} users)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
