/**
 * Mirrors Prisma `AgeRange` string values for UI and client components.
 * Do not import `@db` from `"use client"` files — it pulls Prisma's Node runtime into the browser bundle.
 *
 * Product policy: only 18+ age bands are selectable. `UNDER_18` remains on the Prisma enum for
 * legacy rows only and must not appear in UI or accept new writes.
 */
export const AgeRange = {
  EIGHTEEN_24: "EIGHTEEN_24",
  TWENTY5_34: "TWENTY5_34",
  THIRTY5_44: "THIRTY5_44",
  FORTY5_54: "FORTY5_54",
  FIFTY5_PLUS: "FIFTY5_PLUS",
  UNDER_18: "UNDER_18",
  PREFER_NOT_TO_SAY: "PREFER_NOT_TO_SAY",
} as const;

export type AgeRange = (typeof AgeRange)[keyof typeof AgeRange];

/** 18+ age bands shared by reader profile pickers and partner targeting. */
export const AGE_BAND_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: AgeRange.EIGHTEEN_24, label: "18–24" },
  { value: AgeRange.TWENTY5_34, label: "25–34" },
  { value: AgeRange.THIRTY5_44, label: "35–44" },
  { value: AgeRange.FORTY5_54, label: "45–54" },
  { value: AgeRange.FIFTY5_PLUS, label: "55+" },
];

/** Reader profile pickers (onboarding + account). Empty value means prefer not to say (stored as null). */
export const USER_AGE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  ...AGE_BAND_OPTIONS,
];

/** Partner book targeting and admin test scenarios (18+ bands plus unspecified readers). */
export const TARGETING_AGE_RANGE_OPTIONS: { value: AgeRange; label: string }[] = [
  ...AGE_BAND_OPTIONS,
  { value: AgeRange.PREFER_NOT_TO_SAY, label: "Prefer not to say" },
];

const USER_AGE_BAND_VALUES = new Set(AGE_BAND_OPTIONS.map((o) => o.value));
const TARGETING_AGE_VALUES = new Set(TARGETING_AGE_RANGE_OPTIONS.map((o) => o.value));

export function ageRangeToSelectValue(stored: AgeRange | null | undefined): string {
  if (!stored || stored === AgeRange.UNDER_18 || stored === AgeRange.PREFER_NOT_TO_SAY) {
    return "";
  }
  return stored;
}

/** Parse age range for reader profile writes (onboarding + account). Rejects under-18. */
export function parseUserAgeRange(raw: unknown): AgeRange | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  if (raw === AgeRange.UNDER_18 || raw === AgeRange.PREFER_NOT_TO_SAY) return null;
  if (USER_AGE_BAND_VALUES.has(raw as AgeRange)) return raw as AgeRange;
  return null;
}

/** Drop legacy/disallowed values from stored book targeting arrays. */
export function sanitizeTargetingAgeRanges(ranges: string[]): string[] {
  return ranges.filter((value) => TARGETING_AGE_VALUES.has(value as AgeRange));
}

/** Analytics display order for 18+ buckets (legacy under-18 rows roll into "Not specified"). */
export const ANALYTICS_AGE_ORDER = [
  AgeRange.EIGHTEEN_24,
  AgeRange.TWENTY5_34,
  AgeRange.THIRTY5_44,
  AgeRange.FORTY5_54,
  AgeRange.FIFTY5_PLUS,
  AgeRange.PREFER_NOT_TO_SAY,
] as const;

export const ANALYTICS_AGE_LABELS: Record<string, string> = {
  [AgeRange.EIGHTEEN_24]: "18–24",
  [AgeRange.TWENTY5_34]: "25–34",
  [AgeRange.THIRTY5_44]: "35–44",
  [AgeRange.FORTY5_54]: "45–54",
  [AgeRange.FIFTY5_PLUS]: "55+",
  [AgeRange.PREFER_NOT_TO_SAY]: "Prefer not to say",
  UNKNOWN: "Not specified",
};

export function analyticsAgeBucketKey(stored: AgeRange | null | undefined): string {
  if (!stored || stored === AgeRange.UNDER_18) return "UNKNOWN";
  if (ANALYTICS_AGE_ORDER.includes(stored as (typeof ANALYTICS_AGE_ORDER)[number])) {
    return stored;
  }
  return "UNKNOWN";
}
