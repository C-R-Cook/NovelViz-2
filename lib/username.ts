/** Shared username rules for onboarding, account settings, and APIs. */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsernameFormat(s: string): boolean {
  return USERNAME_REGEX.test(s.trim());
}
