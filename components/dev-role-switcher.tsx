"use client";

import { DEV_USER_COOKIE, DEV_USERS_BY_ID, type DevIdentityUser } from "@/lib/dev-users";
import { useCallback, useState } from "react";

const STORAGE_KEY = "dev_user_id";

const READER_IDS = ["dev_user_reader", "dev_user_reader2", "dev_user_reader3"] as const;
const PARTNER_IDS = ["dev_user_partner", "dev_user_partner2"] as const;
const ADMIN_IDS = ["dev_user_admin"] as const;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return m?.[1] ? decodeURIComponent(m[1]!) : null;
}

function writeDevUserCookie(userId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${DEV_USER_COOKIE}=${encodeURIComponent(
    userId,
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
}

function getHomeUrlForUser(user: DevIdentityUser): string {
  if (user.role === "partner") return "/partner/dashboard";
  if (user.role === "admin") return "/admin/books";
  return "/library";
}

function isKnownUserId(s: string | null): s is string {
  return !!s && !!DEV_USERS_BY_ID[s];
}

type Props = {
  /** Server-read dev user id so the control matches `getCurrentUser()` after SSR/hydration. */
  initialUserId?: string | null;
};

export function DevRoleSwitcher({ initialUserId }: Props) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <DevRoleSwitcherInner initialUserId={initialUserId} />;
}

function DevRoleSwitcherInner({ initialUserId }: Props) {
  const [userId, setUserId] = useState<string>(() => {
    if (initialUserId && isKnownUserId(initialUserId)) return initialUserId;
    if (typeof window !== "undefined") {
      const fromCk = readCookie(DEV_USER_COOKIE);
      if (isKnownUserId(fromCk)) return fromCk;
      const legacyRole = readCookie("dev_role");
      if (legacyRole === "reader" || legacyRole === "partner" || legacyRole === "admin") {
        const mapped =
          legacyRole === "reader"
            ? "dev_user_reader"
            : legacyRole === "partner"
              ? "dev_user_partner"
              : "dev_user_admin";
        if (isKnownUserId(mapped)) return mapped;
      }
      const fromLs = localStorage.getItem(STORAGE_KEY);
      if (isKnownUserId(fromLs)) return fromLs;
    }
    return "dev_user_admin";
  });

  const applyUser = useCallback((nextId: string) => {
    if (!isKnownUserId(nextId)) return;
    setUserId(nextId);
    localStorage.setItem(STORAGE_KEY, nextId);
    writeDevUserCookie(nextId);
    const user = DEV_USERS_BY_ID[nextId];
    const target = getHomeUrlForUser(user);
    if (window.location.pathname === target) {
      window.location.reload();
      return;
    }
    window.location.href = target;
  }, []);

  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="hidden text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500 sm:inline">
        Dev user
      </span>
      <select
        value={userId}
        aria-label="Development user"
        onChange={(e) => {
          const v = e.target.value;
          if (isKnownUserId(v)) applyUser(v);
        }}
        className="min-w-[10.5rem] cursor-pointer rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 shadow-inner outline-none ring-amber-500/20 transition focus:border-amber-600/50 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:ring-amber-500/30 dark:focus:border-amber-500/40"
      >
        <optgroup label="Readers">
          {READER_IDS.map((id) => (
            <option key={id} value={id}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Partners">
          {PARTNER_IDS.map((id) => (
            <option key={id} value={id}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Admin">
          {ADMIN_IDS.map((id) => (
            <option key={id} value={id}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
