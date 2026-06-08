import {
  DEFAULT_SCORING_WEIGHTS,
  SCORING_WEIGHT_KEYS,
  type ScoringWeights,
} from "@/lib/featured-scoring-weights";
import { prisma } from "@/lib/prisma";

export { DEFAULT_SCORING_WEIGHTS, SCORING_WEIGHT_KEYS, type ScoringWeights };

const CACHE_TTL_MS = 60_000;

let cache: ScoringWeights | null = null;
let cacheExpiry = 0;

function rowToWeights(row: Record<string, unknown>): ScoringWeights {
  const out = { ...DEFAULT_SCORING_WEIGHTS } as ScoringWeights;
  for (const key of SCORING_WEIGHT_KEYS) {
    const v = row[key];
    if (typeof v === "number" && Number.isInteger(v) && v > 0) {
      out[key] = v;
    }
  }
  return out;
}

export async function getScoringWeights(): Promise<ScoringWeights> {
  if (cache && Date.now() < cacheExpiry) return cache;
  const row = await prisma.featuredScoringConfig.findUnique({
    where: { id: "singleton" },
  });
  cache = row ? rowToWeights(row) : { ...DEFAULT_SCORING_WEIGHTS };
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cache;
}

export function invalidateScoringWeightsCache(): void {
  cache = null;
  cacheExpiry = 0;
}

export function weightsFromInput(input: Partial<ScoringWeights>): ScoringWeights {
  return rowToWeights({ ...DEFAULT_SCORING_WEIGHTS, ...input });
}

export function historyWeightsFromRow(row: {
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
}): ScoringWeights {
  return rowToWeights(row);
}
