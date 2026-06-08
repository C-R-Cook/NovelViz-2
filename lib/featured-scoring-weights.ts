/** Client-safe scoring weight defaults and types (no Prisma / server imports). */

export const DEFAULT_SCORING_WEIGHTS = {
  scoreGenrePrefMatch: 40,
  scoreLibraryDeep: 25,
  scoreLibraryStarted: 20,
  scoreLibraryRecentUnread: 5,
  scoreLibraryStaleUnread: 2,
  libraryMatchCap: 3,
  libraryRecencyDays: 90,
  scoreRecencyFresh: 30,
  scoreRecencyRecent: 15,
  scoreRecencyWarm: 5,
  recencyFreshDays: 7,
  recencyRecentDays: 30,
  recencyWarmDays: 90,
  scoreGenderMatch: 15,
  scoreAgeMatch: 12,
  scoreCountryMatch: 8,
  penaltyGenderMismatch: 40,
  penaltyAgeMismatch: 30,
  penaltyCountryMismatch: 15,
  minCarouselSlots: 3,
};

export type ScoringWeights = {
  scoreGenrePrefMatch: number;
  scoreLibraryDeep: number;
  scoreLibraryStarted: number;
  scoreLibraryRecentUnread: number;
  scoreLibraryStaleUnread: number;
  libraryMatchCap: number;
  libraryRecencyDays: number;
  scoreRecencyFresh: number;
  scoreRecencyRecent: number;
  scoreRecencyWarm: number;
  recencyFreshDays: number;
  recencyRecentDays: number;
  recencyWarmDays: number;
  scoreGenderMatch: number;
  scoreAgeMatch: number;
  scoreCountryMatch: number;
  penaltyGenderMismatch: number;
  penaltyAgeMismatch: number;
  penaltyCountryMismatch: number;
  minCarouselSlots: number;
};

export const SCORING_WEIGHT_KEYS = Object.keys(
  DEFAULT_SCORING_WEIGHTS,
) as (keyof ScoringWeights)[];
