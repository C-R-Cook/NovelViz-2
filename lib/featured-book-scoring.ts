import type { ScoringWeights } from "@/lib/featured-scoring-weights";

export type LibraryProgress = "not_started" | "in_progress" | "more_than_halfway";
export type LibraryAddedRecency = "recent" | "stale";

export type LibraryBookEntry = {
  genre: string;
  progress: LibraryProgress;
  addedRecency: LibraryAddedRecency;
};

/** Production profile from DB queries. */
export type UserScoringProfile = {
  genrePreferences: string[];
  libraryBooks: LibraryBookEntry[];
  ageRange: string | null;
  gender: string | null;
  country: string | null;
};

export type FeaturedBookWithTargeting = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string;
  genre: string | null;
  readerCount: number;
  description?: string | null;
  isPublicDomain: boolean;
  createdAt: Date;
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
  featuredTargetGenres: string[];
};

export type ScoringDimensionKey =
  | "genrePreferences"
  | "librarySignal"
  | "recency"
  | "gender"
  | "ageRange"
  | "country";

export type ScoringDimensions = Record<ScoringDimensionKey, number>;

export type ScoredBook = {
  book: FeaturedBookWithTargeting;
  score: number;
  isPersonalised: boolean;
};

export function getEffectiveTargetGenres(book: FeaturedBookWithTargeting): string[] {
  const base = book.genre ? [book.genre] : [];
  if (book.featuredTargetGenres.length === 0) return base;
  return [...new Set([...base, ...book.featuredTargetGenres])];
}

export function getRecencyScore(book: FeaturedBookWithTargeting, weights: ScoringWeights): number {
  if (book.isPublicDomain) return 0;
  const daysSinceUpload =
    (Date.now() - book.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpload <= weights.recencyFreshDays) return weights.scoreRecencyFresh;
  if (daysSinceUpload <= weights.recencyRecentDays) return weights.scoreRecencyRecent;
  if (daysSinceUpload <= weights.recencyWarmDays) return weights.scoreRecencyWarm;
  return 0;
}

function scoreGenrePreferences(
  profile: UserScoringProfile,
  book: FeaturedBookWithTargeting,
  weights: ScoringWeights,
): number {
  const effective = new Set(getEffectiveTargetGenres(book));
  if (effective.size === 0) return 0;
  let score = 0;
  for (const genre of profile.genrePreferences) {
    if (effective.has(genre)) score += weights.scoreGenrePrefMatch;
  }
  return score;
}

function scoreLibrarySignal(
  profile: UserScoringProfile,
  book: FeaturedBookWithTargeting,
  weights: ScoringWeights,
): number {
  const effective = new Set(getEffectiveTargetGenres(book));
  if (effective.size === 0) return 0;

  let matches = 0;
  let score = 0;

  for (const entry of profile.libraryBooks) {
    if (!effective.has(entry.genre)) continue;
    if (matches >= weights.libraryMatchCap) break;

    if (entry.progress === "more_than_halfway") {
      score += weights.scoreLibraryDeep;
    } else if (entry.progress === "in_progress") {
      score += weights.scoreLibraryStarted;
    } else if (entry.addedRecency === "recent") {
      score += weights.scoreLibraryRecentUnread;
    } else {
      score += weights.scoreLibraryStaleUnread;
    }
    matches++;
  }

  return score;
}

function scoreDemographicField(input: {
  readerValue: string | null;
  targetValues: string[];
  matchBonus: number;
  mismatchPenalty: number;
}): number {
  const { readerValue, targetValues, matchBonus, mismatchPenalty } = input;
  if (targetValues.length === 0) return 0;
  if (readerValue == null) return 0;
  if (targetValues.includes(readerValue)) return matchBonus;
  return -mismatchPenalty;
}

export function scoreBookDimensions(
  profile: UserScoringProfile,
  book: FeaturedBookWithTargeting,
  weights: ScoringWeights,
): ScoringDimensions & { total: number } {
  const genrePreferences = scoreGenrePreferences(profile, book, weights);
  const librarySignal = scoreLibrarySignal(profile, book, weights);
  const recency = getRecencyScore(book, weights);
  const gender = scoreDemographicField({
    readerValue: profile.gender,
    targetValues: book.featuredTargetGenders,
    matchBonus: weights.scoreGenderMatch,
    mismatchPenalty: weights.penaltyGenderMismatch,
  });
  const ageRange = scoreDemographicField({
    readerValue: profile.ageRange,
    targetValues: book.featuredTargetAgeRanges,
    matchBonus: weights.scoreAgeMatch,
    mismatchPenalty: weights.penaltyAgeMismatch,
  });
  const country = scoreDemographicField({
    readerValue: profile.country,
    targetValues: book.featuredTargetCountries,
    matchBonus: weights.scoreCountryMatch,
    mismatchPenalty: weights.penaltyCountryMismatch,
  });

  const total =
    genrePreferences + librarySignal + recency + gender + ageRange + country;

  return {
    genrePreferences,
    librarySignal,
    recency,
    gender,
    ageRange,
    country,
    total,
  };
}

export function scoreBook(
  profile: UserScoringProfile,
  book: FeaturedBookWithTargeting,
  weights: ScoringWeights,
): number {
  return scoreBookDimensions(profile, book, weights).total;
}

export function rankFeaturedBooks(
  books: FeaturedBookWithTargeting[],
  profile: UserScoringProfile | null,
  limit: number,
  weights: ScoringWeights,
): ScoredBook[] {
  if (profile == null) {
    return books.slice(0, limit).map((book) => ({
      book,
      score: 0,
      isPersonalised: false,
    }));
  }

  const scored = books
    .map((book) => ({
      book,
      score: scoreBook(profile, book, weights),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.book.createdAt.getTime() - a.book.createdAt.getTime();
    });

  const slice = scored.slice(0, limit);
  if (slice.length === 0 && books.length > 0) {
    return books.slice(0, limit).map((book) => ({
      book,
      score: 0,
      isPersonalised: false,
    }));
  }

  return slice.map((s) => ({
    book: s.book,
    score: s.score,
    isPersonalised: s.score > 0,
  }));
}

/** Map production DB library data into scoring entries. */
export function libraryEntriesFromDb(input: {
  genre: string | null;
  currentChapterNumber: number;
  chapterTotal: number;
  addedAt: Date;
  recencyDays: number;
}): LibraryBookEntry | null {
  if (!input.genre) return null;
  let progress: LibraryProgress = "not_started";
  if (input.chapterTotal > 0 && input.currentChapterNumber > input.chapterTotal * 0.5) {
    progress = "more_than_halfway";
  } else if (input.currentChapterNumber > 0) {
    progress = "in_progress";
  }
  const daysSinceAdded =
    (Date.now() - input.addedAt.getTime()) / (1000 * 60 * 60 * 24);
  const addedRecency: LibraryAddedRecency =
    daysSinceAdded <= input.recencyDays ? "recent" : "stale";
  return { genre: input.genre, progress, addedRecency };
}

export function qualitativeMatchTag(total: number): string {
  if (total >= 120) return "Strong match";
  if (total >= 60) return "Good match";
  if (total >= 20) return "Weak match";
  if (total >= 1) return "Marginal";
  return "Unlikely to surface";
}
