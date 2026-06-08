import {
  DEFAULT_SCORING_WEIGHTS,
  SCORING_WEIGHT_KEYS,
  type ScoringWeights,
  weightsFromInput,
} from "@/lib/featured-scoring-config";

export function parseScoringWeightsBody(body: unknown): ScoringWeights | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON body" };
  }
  const raw = body as Record<string, unknown>;
  const partial: Partial<ScoringWeights> = {};

  for (const key of SCORING_WEIGHT_KEYS) {
    if (!(key in raw)) {
      return { error: `Missing field: ${key}` };
    }
    const v = raw[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
      return { error: `${key} must be a positive integer` };
    }
    partial[key] = v;
  }

  return weightsFromInput(partial);
}

export function serializeScoringConfigResponse(input: {
  current: ScoringWeights;
  lastUpdatedAt: Date | null;
  lastUpdatedBy: string | null;
}) {
  return {
    current: input.current,
    defaults: { ...DEFAULT_SCORING_WEIGHTS },
    lastUpdatedAt: input.lastUpdatedAt?.toISOString() ?? null,
    lastUpdatedBy: input.lastUpdatedBy,
  };
}
