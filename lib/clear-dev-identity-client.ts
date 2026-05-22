import { DEV_USER_COOKIE } from "@/lib/dev-users";

/** Matches `DevRoleSwitcher` localStorage key. */
export const DEV_USER_STORAGE_KEY = "dev_user_id";

/** Clears dev role switcher cookies and localStorage (browser only). */
export function clearDevIdentityOnClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `dev_role=; path=/; max-age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(DEV_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
