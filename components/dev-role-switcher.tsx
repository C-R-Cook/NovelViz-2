"use client";

import {
  clearDevIdentityOnClient,
  DEV_USER_STORAGE_KEY,
  enableDevGuestModeOnClient,
} from "@/lib/clear-dev-identity-client";
import { DEV_GUEST_COOKIE, DEV_GUEST_SELECT_VALUE } from "@/lib/dev-guest-mode";
import { DEV_USER_COOKIE, DEV_USERS_BY_ID } from "@/lib/dev-users";
import { useCallback, useState } from "react";

const READER_IDS = ["dev_user_reader", "dev_user_reader2", "dev_user_reader3"] as const;
const PARTNER_IDS = ["dev_user_partner", "dev_user_partner2"] as const;
const ADMIN_IDS = ["dev_user_admin"] as const;

const PUBLIC_BROWSE_URL = "/discover";

function writeDevUserCookie(userId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${DEV_USER_COOKIE}=${encodeURIComponent(
    userId,
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${DEV_GUEST_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
}

function isKnownUserId(s: string | null | undefined): s is string {
  return !!s && !!DEV_USERS_BY_ID[s];
}

type Props = {
  /** True when Clerk has an active session (dev cookie is ignored server-side unless guest preview). */
  clerkSignedIn: boolean;
  /** Dev cookie value from the server — must match client initial state to avoid hydration errors. */
  devCookieUserId: string | null;
  /** Dev guest preview — treat as logged out across the app. */
  devGuestMode: boolean;
};

export function DevRoleSwitcher({ clerkSignedIn, devCookieUserId, devGuestMode }: Props) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return (
    <DevRoleSwitcherInner
      clerkSignedIn={clerkSignedIn}
      devCookieUserId={devCookieUserId}
      devGuestMode={devGuestMode}
    />
  );
}

function DevRoleSwitcherInner({ clerkSignedIn, devCookieUserId, devGuestMode }: Props) {
  const [userId, setUserId] = useState(() => {
    if (devGuestMode) return DEV_GUEST_SELECT_VALUE;
    if (isKnownUserId(devCookieUserId)) return devCookieUserId;
    return DEV_GUEST_SELECT_VALUE;
  });

  const navigateAfterIdentityChange = useCallback((target: string) => {
    if (window.location.pathname === target) {
      window.location.reload();
      return;
    }
    window.location.href = target;
  }, []);

  const applyGuest = useCallback(() => {
    setUserId(DEV_GUEST_SELECT_VALUE);
    enableDevGuestModeOnClient();
    navigateAfterIdentityChange(PUBLIC_BROWSE_URL);
  }, [navigateAfterIdentityChange]);

  const applyUser = useCallback(
    (nextId: string) => {
      if (clerkSignedIn) return;
      if (!isKnownUserId(nextId)) return;
      setUserId(nextId);
      localStorage.setItem(DEV_USER_STORAGE_KEY, nextId);
      writeDevUserCookie(nextId);
      navigateAfterIdentityChange("/library");
    },
    [clerkSignedIn, navigateAfterIdentityChange],
  );

  return (
    <label className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-warning">Dev user</span>
      {clerkSignedIn ? (
        <span className="max-w-[14rem] text-[10px] leading-snug text-text-muted">
          Choose Unregistered for guest preview, or sign out of Clerk to impersonate dev users
        </span>
      ) : null}
      <select
        value={userId}
        aria-label="Development user"
        onChange={(e) => {
          const v = e.target.value;
          if (v === DEV_GUEST_SELECT_VALUE) {
            applyGuest();
            return;
          }
          if (isKnownUserId(v)) applyUser(v);
        }}
        className="min-w-[10.5rem] cursor-pointer rounded-lg border border-border bg-bg-raised px-2 py-1.5 text-xs font-medium text-text-primary shadow-inner outline-none ring-accent/30 transition focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <option value={DEV_GUEST_SELECT_VALUE}>Unregistered (guest)</option>
        <optgroup label="Readers">
          {READER_IDS.map((id) => (
            <option key={id} value={id} disabled={clerkSignedIn}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Partners">
          {PARTNER_IDS.map((id) => (
            <option key={id} value={id} disabled={clerkSignedIn}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Admin">
          {ADMIN_IDS.map((id) => (
            <option key={id} value={id} disabled={clerkSignedIn}>
              {DEV_USERS_BY_ID[id].name ?? id}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
