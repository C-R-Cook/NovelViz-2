/** Dev-only: browse the app with no authenticated user (guest / logged-out UX). */
export const DEV_GUEST_COOKIE = "dev_guest_mode";

export const DEV_GUEST_SELECT_VALUE = "__guest__";

export function isDevGuestModeCookie(value: string | undefined): boolean {
  return value === "1";
}

export function hasDevGuestMode(
  devGuestMode: string | undefined,
): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return isDevGuestModeCookie(devGuestMode);
}
