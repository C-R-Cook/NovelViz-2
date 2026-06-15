import { DEV_USER_COOKIE } from "@/lib/dev-users";
import { DEV_GUEST_COOKIE } from "@/lib/dev-guest-mode";

/** Matches `DevRoleSwitcher` localStorage key. */
export const DEV_USER_STORAGE_KEY = "dev_user_id";

/** Clears dev role switcher cookies and localStorage (browser only). */
export function clearDevIdentityOnClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${DEV_GUEST_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(DEV_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function enableDevGuestModeOnClient(): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${DEV_GUEST_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(DEV_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
