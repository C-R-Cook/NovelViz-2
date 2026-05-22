"use client";

import { DEV_USER_STORAGE_KEY } from "@/lib/clear-dev-identity-client";
import { DEV_USER_COOKIE, DEV_USERS_BY_ID } from "@/lib/dev-users";
import { useCallback, useState } from "react";

const READER_IDS = ["dev_user_reader", "dev_user_reader2", "dev_user_reader3"] as const;
const PARTNER_IDS = ["dev_user_partner", "dev_user_partner2"] as const;
const ADMIN_IDS = ["dev_user_admin"] as const;

function writeDevUserCookie(userId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${DEV_USER_COOKIE}=${encodeURIComponent(
    userId,
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
}

function getHomeUrlForUser(): string {
  return "/library";
}

function isKnownUserId(s: string | null | undefined): s is string {
  return !!s && !!DEV_USERS_BY_ID[s];
}

type Props = {
  /** True when Clerk has an active session (dev cookie is ignored server-side). */
  clerkSignedIn: boolean;
  /** Dev cookie value from the server — must match client initial state to avoid hydration errors. */
  devCookieUserId: string | null;
};

export function DevRoleSwitcher({ clerkSignedIn, devCookieUserId }: Props) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <DevRoleSwitcherInner clerkSignedIn={clerkSignedIn} devCookieUserId={devCookieUserId} />;
}

function DevRoleSwitcherInner({ clerkSignedIn, devCookieUserId }: Props) {
  const [userId, setUserId] = useState(() =>
    isKnownUserId(devCookieUserId) ? devCookieUserId : "",
  );

  const applyUser = useCallback(
    (nextId: string) => {
      if (clerkSignedIn) return;
      if (!isKnownUserId(nextId)) return;
      setUserId(nextId);
      localStorage.setItem(DEV_USER_STORAGE_KEY, nextId);
      writeDevUserCookie(nextId);
      const target = getHomeUrlForUser();
      if (window.location.pathname === target) {
        window.location.reload();
        return;
      }
      window.location.href = target;
    },
    [clerkSignedIn],
  );

  return (
    <label className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-warning">Dev user</span>
      {clerkSignedIn ? (
        <span className="max-w-[14rem] text-[10px] leading-snug text-text-muted">
          Sign out to impersonate dev users
        </span>
      ) : null}
      <select
        value={userId || ""}
        disabled={clerkSignedIn}
        aria-label="Development user"
        title={clerkSignedIn ? "Sign out of Clerk before using dev users" : undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (isKnownUserId(v)) applyUser(v);
        }}
        className="min-w-[10.5rem] cursor-pointer rounded-lg border border-border bg-bg-raised px-2 py-1.5 text-xs font-medium text-text-primary shadow-inner outline-none ring-accent/30 transition focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          Choose dev user
        </option>
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
