/**
 * Internal cost estimates (USD). Tune constants when provider pricing changes.
 * Anthropic: aligned with Sonnet-class tiers used by Q&A / imagine (see ANTHROPIC_MODEL).
 */
export const ANTHROPIC_USD_PER_M_INPUT = 3;
export const ANTHROPIC_USD_PER_M_OUTPUT = 15;

/** text-embedding-3-small — see OpenAI pricing. */
export const OPENAI_EMBEDDING_USD_PER_M = 0.02;

/** gpt-4o-mini — genre detection in ingest. */
export const OPENAI_GPT4O_MINI_USD_PER_M_INPUT = 0.15;
export const OPENAI_GPT4O_MINI_USD_PER_M_OUTPUT = 0.6;

/** fal flux/schnell — rough per-image when live vendor data unavailable. */
export const FAL_FLUX_SCHNELL_EST_USD_PER_IMAGE = 0.003;

export const ESTIMATED_COSTS_FOOTNOTE =
  "Anthropic costs are estimated from stored token counts. OpenAI and fal.ai actual spend shown in Vendor Billing below.";

export type DailyCountPoint = { date: string; count: number };

export function utcStartOfCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatDayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Builds one row per UTC calendar day from start through end (inclusive).
 * `rawCounts` keys are `YYYY-MM-DD` (UTC).
 */
export function buildDailySeries(
  rangeStartInclusive: Date,
  rangeEndInclusive: Date,
  rawCounts: ReadonlyMap<string, number>,
): DailyCountPoint[] {
  const start = utcStartOfCalendarDay(rangeStartInclusive);
  const end = utcStartOfCalendarDay(rangeEndInclusive);
  const out: DailyCountPoint[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const day = new Date(t);
    const key = formatDayKeyUtc(day);
    out.push({ date: key, count: rawCounts.get(key) ?? 0 });
  }
  return out;
}

/** Display: > $1 absolute → 2 decimals; otherwise 4 (e.g. $0.0042). */
export function formatUsd(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.0000";
  const abs = Math.abs(n);
  const decimals = abs > 1 ? 2 : 4;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${abs.toFixed(decimals)}`;
}

export function estimateAnthropicUsd(promptTokens: number, completionTokens: number): number {
  return (
    (Math.max(0, promptTokens) / 1_000_000) * ANTHROPIC_USD_PER_M_INPUT +
    (Math.max(0, completionTokens) / 1_000_000) * ANTHROPIC_USD_PER_M_OUTPUT
  );
}

export function estimateOpenAiEmbeddingUsd(embeddingTokens: number): number {
  return (Math.max(0, embeddingTokens) / 1_000_000) * OPENAI_EMBEDDING_USD_PER_M;
}

export function estimateGpt4oMiniUsd(promptTokens: number, completionTokens: number): number {
  return (
    (Math.max(0, promptTokens) / 1_000_000) * OPENAI_GPT4O_MINI_USD_PER_M_INPUT +
    (Math.max(0, completionTokens) / 1_000_000) * OPENAI_GPT4O_MINI_USD_PER_M_OUTPUT
  );
}

export function estimateFalImageUsd(imageCount: number): number {
  return Math.max(0, imageCount) * FAL_FLUX_SCHNELL_EST_USD_PER_IMAGE;
}
