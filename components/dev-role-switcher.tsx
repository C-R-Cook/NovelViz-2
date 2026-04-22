"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "dev_role";
type UserRole = "reader" | "partner" | "admin";
const USER_ROLE = {
  reader: "reader" as UserRole,
  partner: "partner" as UserRole,
  admin: "admin" as UserRole,
};

export type DevRoleSwitcherInitialRole = UserRole;

function isUserRole(s: string | null): s is UserRole {
  return s === USER_ROLE.reader || s === USER_ROLE.partner || s === USER_ROLE.admin;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return m?.[1] ? decodeURIComponent(m[1]!) : null;
}

function writeDevRoleCookie(role: UserRole) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `dev_role=${encodeURIComponent(
    role,
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getRoleHomeUrl(role: UserRole): string {
  if (role === USER_ROLE.partner) return "/partner/dashboard";
  if (role === USER_ROLE.admin) return "/admin/books";
  return "/library";
}

type Props = {
  /** Server-read dev role so the control matches `getCurrentUser()` after SSR/hydration. */
  initialRole?: DevRoleSwitcherInitialRole;
};

export function DevRoleSwitcher({ initialRole }: Props) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <DevRoleSwitcherInner initialRole={initialRole} />;
}

function DevRoleSwitcherInner({ initialRole }: Props) {
  const [role, setRole] = useState<UserRole>(() => {
    if (initialRole && isUserRole(initialRole)) return initialRole;
    if (typeof window !== "undefined") {
      const fromCk = readCookie("dev_role");
      if (isUserRole(fromCk)) return fromCk;
      const fromLs = localStorage.getItem(STORAGE_KEY);
      if (isUserRole(fromLs)) return fromLs;
    }
    return USER_ROLE.admin;
  });

  const applyRole = useCallback(
    (next: UserRole) => {
      setRole(next);
      localStorage.setItem(STORAGE_KEY, next);
      writeDevRoleCookie(next);
      const target = getRoleHomeUrl(next);
      if (window.location.pathname === target) {
        window.location.reload();
        return;
      }
      window.location.href = target;
    },
    [],
  );

  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="hidden text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500 sm:inline">
        Dev role
      </span>
      <select
        value={role}
        aria-label="Development role"
        onChange={(e) => {
          const v = e.target.value;
          if (isUserRole(v)) applyRole(v);
        }}
        className="min-w-[6.75rem] cursor-pointer rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 shadow-inner outline-none ring-amber-500/20 transition focus:border-amber-600/50 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:ring-amber-500/30 dark:focus:border-amber-500/40"
      >
        <option value={USER_ROLE.reader}>Reader</option>
        <option value={USER_ROLE.partner}>Partner</option>
        <option value={USER_ROLE.admin}>Admin</option>
      </select>
    </label>
  );
}
