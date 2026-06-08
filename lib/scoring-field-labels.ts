import type { ScoringWeights } from "@/lib/featured-scoring-weights";
import { SCORING_WEIGHT_KEYS } from "@/lib/featured-scoring-weights";

export type ScoringFieldMeta = { short: string; full: string };

export const SCORING_FIELD_META: Record<keyof ScoringWeights, ScoringFieldMeta> = {
  scoreGenrePrefMatch: {
    short: "Genre pref",
    full: "Genre preference match",
  },
  scoreLibraryDeep: {
    short: "Lib - Deep",
    full: "Library deep read (>50% progress)",
  },
  scoreLibraryStarted: {
    short: "Lib - Started",
    full: "Library started (in progress)",
  },
  scoreLibraryRecentUnread: {
    short: "Lib - Recent",
    full: "Library recent unread",
  },
  scoreLibraryStaleUnread: {
    short: "Lib - Stale",
    full: "Library stale unread",
  },
  libraryMatchCap: {
    short: "Lib cap",
    full: "Library match cap",
  },
  libraryRecencyDays: {
    short: "Lib recency",
    full: "Library recency window (days)",
  },
  scoreRecencyFresh: {
    short: "Fresh boost",
    full: "Recency fresh boost",
  },
  scoreRecencyRecent: {
    short: "Recent boost",
    full: "Recency recent boost",
  },
  scoreRecencyWarm: {
    short: "Warm boost",
    full: "Recency warm boost",
  },
  recencyFreshDays: {
    short: "Fresh days",
    full: "Recency fresh window (days)",
  },
  recencyRecentDays: {
    short: "Recent days",
    full: "Recency recent window (days)",
  },
  recencyWarmDays: {
    short: "Warm days",
    full: "Recency warm window (days)",
  },
  scoreGenderMatch: {
    short: "Gender bonus",
    full: "Gender match bonus",
  },
  scoreAgeMatch: {
    short: "Age bonus",
    full: "Age range match bonus",
  },
  scoreCountryMatch: {
    short: "Country bonus",
    full: "Country match bonus",
  },
  penaltyGenderMismatch: {
    short: "Gender penalty",
    full: "Gender mismatch penalty",
  },
  penaltyAgeMismatch: {
    short: "Age penalty",
    full: "Age mismatch penalty",
  },
  penaltyCountryMismatch: {
    short: "Country penalty",
    full: "Country mismatch penalty",
  },
  minCarouselSlots: {
    short: "Min slots",
    full: "Min carousel slots",
  },
};

/** Full labels — used in history panels and audit views. */
export const SCORING_FIELD_LABELS: Record<keyof ScoringWeights, string> = Object.fromEntries(
  SCORING_WEIGHT_KEYS.map((key) => [key, SCORING_FIELD_META[key].full]),
) as Record<keyof ScoringWeights, string>;

export const SCORING_FIELD_GROUPS: {
  title: string;
  keys: (keyof ScoringWeights)[];
}[] = [
  {
    title: "Genre Signals",
    keys: [
      "scoreGenrePrefMatch",
      "scoreLibraryDeep",
      "scoreLibraryStarted",
      "scoreLibraryRecentUnread",
      "scoreLibraryStaleUnread",
      "libraryMatchCap",
      "libraryRecencyDays",
    ],
  },
  {
    title: "Recency Boost (Partner Uploads)",
    keys: [
      "scoreRecencyFresh",
      "scoreRecencyRecent",
      "scoreRecencyWarm",
      "recencyFreshDays",
      "recencyRecentDays",
      "recencyWarmDays",
    ],
  },
  {
    title: "Demographic Match Bonuses",
    keys: ["scoreGenderMatch", "scoreAgeMatch", "scoreCountryMatch"],
  },
  {
    title: "Demographic Mismatch Penalties",
    keys: ["penaltyGenderMismatch", "penaltyAgeMismatch", "penaltyCountryMismatch"],
  },
];

export function diffScoringWeights(
  previous: ScoringWeights,
  next: ScoringWeights,
): Partial<Record<keyof ScoringWeights, { from: number; to: number }>> {
  const diff: Partial<Record<keyof ScoringWeights, { from: number; to: number }>> = {};
  for (const key of SCORING_WEIGHT_KEYS) {
    if (previous[key] !== next[key]) {
      diff[key] = { from: previous[key], to: next[key] };
    }
  }
  return diff;
}
