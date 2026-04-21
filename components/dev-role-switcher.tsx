"use client";

import { UserRole } from "@/app/generated/prisma/enums";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dev_role";

function isUserRole(s: string | null): s is UserRole {
  return s === "reader" || s === "partner" || s === "admin";
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

export function DevRoleSwitcher() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <DevRoleSwitcherInner />;
}

function DevRoleSwitcherInner() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(UserRole.admin);
  const [mounted, setMounted] = useState(false);

  const applyRole = useCallback(
    (next: UserRole) => {
      setRole(next);
      localStorage.setItem(STORAGE_KEY, next);
      writeDevRoleCookie(next);
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    setMounted(true);
    const fromLs = localStorage.getItem(STORAGE_KEY);
    if (isUserRole(fromLs)) {
      if (readCookie("dev_role") !== fromLs) {
        writeDevRoleCookie(fromLs);
        setRole(fromLs);
        router.refresh();
      } else {
        setRole(fromLs);
      }
    } else {
      const fromCk = readCookie("dev_role");
      if (isUserRole(fromCk)) {
        localStorage.setItem(STORAGE_KEY, fromCk);
        setRole(fromCk);
      }
    }
  }, [router]);

  if (!mounted) {
    return null;
  }

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
        <option value={UserRole.reader}>Reader</option>
        <option value={UserRole.partner}>Partner</option>
        <option value={UserRole.admin}>Admin</option>
      </select>
    </label>
  );
}
