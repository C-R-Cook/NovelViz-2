import type { ScoringDimensions } from "@/lib/featured-book-scoring";
import type { ScoringWeights } from "@/lib/featured-scoring-weights";

export const RADAR_DIMENSION_LABELS: Record<keyof ScoringDimensions, string> = {
  genrePreferences: "Genre Preferences",
  librarySignal: "Library Signal",
  recency: "Recency",
  gender: "Gender",
  ageRange: "Age Range",
  country: "Country",
};

export type RadarPoint = {
  dimension: keyof ScoringDimensions;
  label: string;
  normalized: number;
  raw: number;
};

function dimensionMax(weights: ScoringWeights, dimension: keyof ScoringDimensions): number {
  switch (dimension) {
    case "genrePreferences":
      return weights.scoreGenrePrefMatch * 5;
    case "librarySignal":
      return weights.scoreLibraryDeep * weights.libraryMatchCap;
    case "recency":
      return weights.scoreRecencyFresh;
    case "gender":
      return weights.scoreGenderMatch;
    case "ageRange":
      return weights.scoreAgeMatch;
    case "country":
      return weights.scoreCountryMatch;
    default:
      return 1;
  }
}

function dimensionMin(weights: ScoringWeights, dimension: keyof ScoringDimensions): number {
  switch (dimension) {
    case "gender":
      return -weights.penaltyGenderMismatch;
    case "ageRange":
      return -weights.penaltyAgeMismatch;
    case "country":
      return -weights.penaltyCountryMismatch;
    default:
      return 0;
  }
}

/** Map raw dimension score to 0–100 where 50 = neutral. */
export function normalizeDimensionScore(
  raw: number,
  dimension: keyof ScoringDimensions,
  weights: ScoringWeights,
): number {
  const max = dimensionMax(weights, dimension);
  const min = dimensionMin(weights, dimension);

  if (raw === 0 && min === 0) return 50;

  if (raw >= 0) {
    if (max <= 0) return 50;
    return 50 + (raw / max) * 50;
  }

  if (min >= 0) return 50;
  // Map [min, 0] → [0, 50] so full penalty (raw === min) reaches 0, not 100.
  return ((raw - min) / -min) * 50;
}

export function buildRadarPoints(
  dimensions: ScoringDimensions,
  weights: ScoringWeights,
): RadarPoint[] {
  const keys = Object.keys(RADAR_DIMENSION_LABELS) as (keyof ScoringDimensions)[];
  return keys.map((dimension) => ({
    dimension,
    label: RADAR_DIMENSION_LABELS[dimension],
    raw: dimensions[dimension],
    normalized: Math.max(
      0,
      Math.min(100, normalizeDimensionScore(dimensions[dimension], dimension, weights)),
    ),
  }));
}
