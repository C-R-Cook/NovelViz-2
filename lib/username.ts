/** Shared username rules for onboarding, account settings, and APIs. */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsernameFormat(s: string): boolean {
  return USERNAME_REGEX.test(s.trim());
}

export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "");
}
