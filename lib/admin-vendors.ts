import {
  buildDailySeries,
  formatDayKeyUtc,
  utcStartOfCalendarDay,
} from "@/lib/costs";

export type OpenAiVendorSnapshot = {
  totalSpendUsd: number;
  dailySpendUsd: { date: string; amountUsd: number }[];
  totalEmbeddingTokens: number | null;
};

export type FalModelBreakdownRow = {
  endpointId: string;
  quantity: number;
  costUsd: number;
};

export type FalVendorSnapshot = {
  totalSpendUsd: number;
  imagesGenerated: number;
  dailySpendUsd: { date: string; amountUsd: number }[];
  byModel: FalModelBreakdownRow[];
};

export type VendorFetchResult<T> = {
  snapshot: T | null;
  errorMessage: string | null;
};

type OpenAiCostBucket = {
  start_time: number;
  end_time?: number;
  results?: Array<{
    amount?: { value?: number; currency?: string };
  }>;
};

type OpenAiEmbeddingsBucket = {
  start_time: number;
  results?: Array<{
    input_tokens?: number;
  }>;
};

function sumBucketUsd(bucket: OpenAiCostBucket): number {
  let sum = 0;
  for (const r of bucket.results ?? []) {
    const v = r.amount?.value;
    const cur = r.amount?.currency?.toLowerCase();
    if (typeof v === "number" && Number.isFinite(v) && cur === "usd") {
      sum += v;
    }
  }
  return sum;
}

function parseOpenAiPage(json: unknown): {
  buckets: OpenAiCostBucket[];
  nextPage: string | null | undefined;
  hasMore: boolean;
} {
  if (Array.isArray(json)) {
    return { buckets: json as OpenAiCostBucket[], nextPage: undefined, hasMore: false };
  }
  if (!json || typeof json !== "object") {
    return { buckets: [], nextPage: undefined, hasMore: false };
  }
  const o = json as Record<string, unknown>;
  const data = o.data;
  if (Array.isArray(data)) {
    return {
      buckets: data as OpenAiCostBucket[],
      nextPage: typeof o.next_page === "string" ? o.next_page : undefined,
      hasMore: Boolean(o.has_more),
    };
  }
  return { buckets: [], nextPage: undefined, hasMore: false };
}

function parseEmbeddingsPage(json: unknown): {
  buckets: OpenAiEmbeddingsBucket[];
  nextPage: string | null | undefined;
  hasMore: boolean;
} {
  if (Array.isArray(json)) {
    return { buckets: json as OpenAiEmbeddingsBucket[], nextPage: undefined, hasMore: false };
  }
  if (!json || typeof json !== "object") {
    return { buckets: [], nextPage: undefined, hasMore: false };
  }
  const o = json as Record<string, unknown>;
  const data = o.data;
  if (Array.isArray(data)) {
    return {
      buckets: data as OpenAiEmbeddingsBucket[],
      nextPage: typeof o.next_page === "string" ? o.next_page : undefined,
      hasMore: Boolean(o.has_more),
    };
  }
  return { buckets: [], nextPage: undefined, hasMore: false };
}

async function fetchOpenAiCostsAllBuckets(adminKey: string, startSec: number): Promise<OpenAiCostBucket[]> {
  const out: OpenAiCostBucket[] = [];
  let page: string | undefined;
  let hasMore = true;
  let guard = 0;
  while (hasMore && guard < 24) {
    guard += 1;
    const params = new URLSearchParams({
      start_time: String(startSec),
      bucket_width: "1d",
      limit: "180",
    });
    if (page) params.set("page", page);
    const res = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI costs ${res.status}: ${text.slice(0, 200)}`);
    }
    const parsed = parseOpenAiPage(await res.json());
    out.push(...parsed.buckets);
    hasMore = Boolean(parsed.hasMore && parsed.nextPage);
    page = parsed.nextPage ?? undefined;
    if (!hasMore) break;
  }
  return out;
}

async function fetchOpenAiEmbeddingsBuckets(adminKey: string, startSec: number): Promise<OpenAiEmbeddingsBucket[]> {
  const out: OpenAiEmbeddingsBucket[] = [];
  let page: string | undefined;
  let hasMore = true;
  let guard = 0;
  while (hasMore && guard < 24) {
    guard += 1;
    const params = new URLSearchParams({
      start_time: String(startSec),
      bucket_width: "1d",
      limit: "180",
    });
    if (page) params.set("page", page);
    const res = await fetch(`https://api.openai.com/v1/organization/usage/embeddings?${params}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI embeddings usage ${res.status}: ${text.slice(0, 200)}`);
    }
    const parsed = parseEmbeddingsPage(await res.json());
    out.push(...parsed.buckets);
    hasMore = Boolean(parsed.hasMore && parsed.nextPage);
    page = parsed.nextPage ?? undefined;
    if (!hasMore) break;
  }
  return out;
}

/**
 * Live OpenAI org costs + embeddings token totals for the UTC window aligned to KPI charts.
 */
export async function fetchOpenAiVendorSnapshot(
  rangeStartUtc: Date,
  rangeEndInclusiveUtc: Date,
): Promise<VendorFetchResult<OpenAiVendorSnapshot>> {
  const adminKey = process.env.OPENAI_ADMIN_API_KEY?.trim();
  if (!adminKey) {
    return {
      snapshot: null,
      errorMessage: "Configure OPENAI_ADMIN_API_KEY to see live OpenAI billing data.",
    };
  }

  try {
    const startSec = Math.floor(rangeStartUtc.getTime() / 1000);
    let costBuckets: OpenAiCostBucket[];
    try {
      costBuckets = await fetchOpenAiCostsAllBuckets(adminKey, startSec);
    } catch (e) {
      console.warn("[admin-vendors] OpenAI costs failed:", e);
      const msg = e instanceof Error ? e.message : "OpenAI costs request failed";
      return {
        snapshot: null,
        errorMessage: msg.includes(" 429")
          ? "OpenAI usage API rate limit exceeded. Try again in a few minutes."
          : "OpenAI billing data request failed.",
      };
    }

    let embedBuckets: OpenAiEmbeddingsBucket[] = [];
    let embeddingsFetchOk = false;
    try {
      embedBuckets = await fetchOpenAiEmbeddingsBuckets(adminKey, startSec);
      embeddingsFetchOk = true;
    } catch (e) {
      console.warn("[admin-vendors] OpenAI embeddings usage failed:", e);
    }

    let totalSpendUsd = 0;
    const spendByDay = new Map<string, number>();
    const rangeStartDay = utcStartOfCalendarDay(rangeStartUtc);
    const rangeEndDay = utcStartOfCalendarDay(rangeEndInclusiveUtc);
    const dayLo = formatDayKeyUtc(rangeStartDay);
    const dayHi = formatDayKeyUtc(rangeEndDay);

    for (const bucket of costBuckets) {
      const day = formatDayKeyUtc(new Date(bucket.start_time * 1000));
      if (day < dayLo || day > dayHi) continue;
      const dayUsd = sumBucketUsd(bucket);
      totalSpendUsd += dayUsd;
      spendByDay.set(day, (spendByDay.get(day) ?? 0) + dayUsd);
    }

    let totalEmbeddingTokens: number | null = null;
    let embedSum = 0;
    for (const bucket of embedBuckets) {
      const day = formatDayKeyUtc(new Date(bucket.start_time * 1000));
      if (day < dayLo || day > dayHi) continue;
      for (const row of bucket.results ?? []) {
        embedSum += row.input_tokens ?? 0;
      }
    }
    if (embeddingsFetchOk) {
      totalEmbeddingTokens = embedSum;
    }

    const dailySpendUsd = buildDailySeries(rangeStartUtc, rangeEndInclusiveUtc, spendByDay).map((row) => ({
      date: row.date,
      amountUsd: row.count,
    }));

    return {
      snapshot: {
        totalSpendUsd,
        dailySpendUsd,
        totalEmbeddingTokens,
      },
      errorMessage: null,
    };
  } catch (e) {
    console.warn("[admin-vendors] openai snapshot:", e);
    const msg = e instanceof Error ? e.message : "OpenAI request failed";
    return {
      snapshot: null,
      errorMessage: msg.includes(" 429")
        ? "OpenAI usage API rate limit exceeded. Try again in a few minutes."
        : "OpenAI billing data request failed.",
    };
  }
}

type FalUsageJson = {
  time_series?: Array<{
    bucket: string;
    results?: Array<{
      endpoint_id: string;
      quantity?: number;
      cost?: number;
      unit?: string;
    }>;
  }>;
  summary?: Array<{
    endpoint_id: string;
    quantity?: number;
    cost?: number;
    unit?: string;
  }>;
};

function parseFalBucketDay(bucketIso: string): string {
  const d = new Date(bucketIso);
  if (Number.isNaN(d.getTime())) return formatDayKeyUtc(new Date());
  return formatDayKeyUtc(d);
}

/**
 * fal Platform API — `Authorization: Key <secret>` (same value as `FAL_API_KEY`).
 */
export async function fetchFalVendorSnapshot(
  rangeStartInclusiveUtc: Date,
  rangeEndInclusiveUtc: Date,
): Promise<VendorFetchResult<FalVendorSnapshot>> {
  const key = process.env.FAL_ADMIN_API_KEY?.trim();
  if (!key) {
    return {
      snapshot: null,
      errorMessage: "No fal.ai usage data available. Check FAL_API_KEY is set.",
    };
  }

  try {
    const start = formatDayKeyUtc(utcStartOfCalendarDay(rangeStartInclusiveUtc));
    const exclusiveEnd = new Date(
      utcStartOfCalendarDay(rangeEndInclusiveUtc).getTime() + 86_400_000,
    );
    const end = formatDayKeyUtc(exclusiveEnd);
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);
    params.set("timeframe", "day");
    params.set("timezone", "UTC");
    params.set("bound_to_timeframe", "true");
    params.append("expand", "time_series");
    params.append("expand", "summary");
    params.set("limit", "200");
    const url = `https://api.fal.ai/v1/models/usage?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`fal usage ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as FalUsageJson;

    const spendByDay = new Map<string, number>();
    const byEndpoint = new Map<string, { quantity: number; costUsd: number }>();

    let imagesGenerated = 0;
    let totalSpendUsd = 0;

    for (const row of body.summary ?? []) {
      const cost = typeof row.cost === "number" && Number.isFinite(row.cost) ? row.cost : 0;
      totalSpendUsd += cost;
      const q = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 0;
      if ((row.unit ?? "").toLowerCase() === "image") {
        imagesGenerated += q;
      }
      const prev = byEndpoint.get(row.endpoint_id) ?? { quantity: 0, costUsd: 0 };
      byEndpoint.set(row.endpoint_id, {
        quantity: prev.quantity + q,
        costUsd: prev.costUsd + cost,
      });
    }

    for (const ts of body.time_series ?? []) {
      const dayKey = parseFalBucketDay(ts.bucket);
      let dayUsd = 0;
      for (const r of ts.results ?? []) {
        const cost = typeof r.cost === "number" && Number.isFinite(r.cost) ? r.cost : 0;
        dayUsd += cost;
      }
      spendByDay.set(dayKey, (spendByDay.get(dayKey) ?? 0) + dayUsd);
    }

    const chartStart = utcStartOfCalendarDay(rangeStartInclusiveUtc);
    const chartEnd = utcStartOfCalendarDay(rangeEndInclusiveUtc);
    const dailySpendUsd = buildDailySeries(chartStart, chartEnd, spendByDay).map((row) => ({
      date: row.date,
      amountUsd: row.count,
    }));

    const byModel: FalModelBreakdownRow[] = [...byEndpoint.entries()].map(([endpointId, v]) => ({
      endpointId,
      quantity: v.quantity,
      costUsd: v.costUsd,
    }));
    byModel.sort((a, b) => b.costUsd - a.costUsd);

    return {
      snapshot: {
        totalSpendUsd,
        imagesGenerated,
        dailySpendUsd,
        byModel,
      },
      errorMessage: null,
    };
  } catch (e) {
    console.warn("[admin-vendors] fal snapshot:", e);
    const msg = e instanceof Error ? e.message : "fal usage request failed";
    if (msg.includes(" 429")) {
      return {
        snapshot: null,
        errorMessage: "fal.ai usage API rate limit exceeded. Try again in a few minutes.",
      };
    }
    if (msg.includes(" 403")) {
      return {
        snapshot: null,
        errorMessage: "FAL_API_KEY is not permitted for the fal.ai usage endpoint.",
      };
    }
    return {
      snapshot: null,
      errorMessage: "No fal.ai usage data available. Check FAL_API_KEY is set.",
    };
  }
}
