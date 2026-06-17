export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 80;

/** Trim and validate a user's real / legal display name (not a public username). */
export function parseDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) return null;
  return trimmed;
}

/** First + last from Clerk — never fall back to Clerk username (that is not a legal name). */
export function nameFromClerkParts(data: {
  first_name?: string | null;
  last_name?: string | null;
}): string | null {
  const joined = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}
