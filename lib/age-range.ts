/**
 * Mirrors Prisma `AgeRange` string values for UI and client components.
 * Do not import `@db` from `"use client"` files — it pulls Prisma's Node runtime into the browser bundle.
 */
export const AgeRange = {
  EIGHTEEN_24: "EIGHTEEN_24",
  TWENTY5_34: "TWENTY5_34",
  THIRTY5_44: "THIRTY5_44",
  FORTY5_54: "FORTY5_54",
  FIFTY5_PLUS: "FIFTY5_PLUS",
} as const;

export type AgeRange = (typeof AgeRange)[keyof typeof AgeRange];

export const AGE_RANGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: AgeRange.EIGHTEEN_24, label: "18–24" },
  { value: AgeRange.TWENTY5_34, label: "25–34" },
  { value: AgeRange.THIRTY5_44, label: "35–44" },
  { value: AgeRange.FORTY5_54, label: "45–54" },
  { value: AgeRange.FIFTY5_PLUS, label: "55+" },
];
