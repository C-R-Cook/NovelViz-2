/**
 * Mirrors Prisma `Gender` string values for UI and client components.
 * Avoid importing `@db` in `"use client"` files.
 */
export const Gender = {
  male: "male",
  female: "female",
  non_binary: "non_binary",
  other: "other",
  prefer_not_to_say: "prefer_not_to_say",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: Gender.male, label: "Male" },
  { value: Gender.female, label: "Female" },
  { value: Gender.non_binary, label: "Non-binary" },
  { value: Gender.other, label: "Other" },
  { value: Gender.prefer_not_to_say, label: "Prefer not to say" },
];
