import { fetchNeonVendorSnapshot, type NeonVendorSnapshot } from "@/lib/admin-neon";
import { fetchFalVendorSnapshot, fetchOpenAiVendorSnapshot, type FalVendorSnapshot, type OpenAiVendorSnapshot } from "@/lib/admin-vendors";
import {
  buildDailySeries,
  ESTIMATED_COSTS_FOOTNOTE,
  estimateAnthropicUsd,
  estimateFalImageUsd,
  estimateGpt4oMiniUsd,
  estimateOpenAiEmbeddingUsd,
  formatDayKeyUtc,
  formatUsd,
  type DailyCountPoint,
  utcStartOfCalendarDay,
} from "@/lib/costs";
import { prisma } from "@/lib/prisma";

export type AdminStatsKpis = {
  totalUsers: number;
  newUsersLast30Days: number;
  libraryAddsTotal: number;
  totalBooks: number;
  publishedBooks: number;
  totalQueries: number;
  totalGeneratedImages: number;
  totalLikes: number;
  queriesLast30Days: number;
  imagesLast30Days: number;
};

export type AdminStatsPayload = {
  generatedAt: string;
  window: { chartStartUtc: string; chartEndInclusiveUtc: string };
  vendorWindowDays: number;
  kpis: AdminStatsKpis;
  charts: {
    queriesByDay: DailyCountPoint[];
    imagesByDay: DailyCountPoint[];
    userGrowthByDay: DailyCountPoint[];
  };
  internal: {
    estimatedCosts: {
      rows: Array<{
        operation: string;
        provider: string;
        estCostUsd: number;
        estCostFormatted: string;
      }>;
      totalUsd: number;
      totalFormatted: string;
    };
    footnote: string;
  };
  vendors: {
    openai: OpenAiVendorSnapshot | null;
    fal: FalVendorSnapshot | null;
    neon: NeonVendorSnapshot | null;
  };
  vendorMessages: {
    openai: string | null;
    fal: string | null;
    neon: string | null;
  };
};

function chartWindow(): {
  startInclusive: Date;
  endInclusive: Date;
  endExclusive: Date;
} {
  const now = new Date();
  const endInclusive = utcStartOfCalendarDay(now);
  const startInclusive = new Date(endInclusive.getTime());
  startInclusive.setUTCDate(startInclusive.getUTCDate() - 29);
  const endExclusive = new Date(endInclusive.getTime() + 86_400_000);
  return { startInclusive, endInclusive, endExclusive };
}

function vendorWindow(days: number): {
  startInclusive: Date;
  endInclusive: Date;
} {
  const endInclusive = utcStartOfCalendarDay(new Date());
  const startInclusive = new Date(endInclusive.getTime());
  startInclusive.setUTCDate(startInclusive.getUTCDate() - (days - 1));
  return { startInclusive, endInclusive };
}

export function normalizeVendorWindowDays(raw: string | number | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  if (n === 7 || n === 14 || n === 30 || n === 90) return n;
  return 30;
}

function rowsToDayMap(rows: Array<{ day: Date; count: bigint }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = formatDayKeyUtc(new Date(row.day));
    map.set(key, Number(row.count));
  }
  return map;
}

export async function getAdminStatsPayload(vendorDays = 30): Promise<AdminStatsPayload> {
  const { startInclusive, endInclusive, endExclusive } = chartWindow();
  const normalizedVendorDays = normalizeVendorWindowDays(vendorDays);
  const { startInclusive: vendorStartInclusive, endInclusive: vendorEndInclusive } =
    vendorWindow(normalizedVendorDays);

  const [
    totalUsers,
    newUsersLast30Days,
    libraryAddsTotal,
    totalBooks,
    publishedBooks,
    totalQueries,
    totalGeneratedImages,
    totalLikes,
    queriesLast30Days,
    imagesLast30Days,
    queryAgg,
    generatedImageAgg,
    bookIngestAgg,
    queryDayRows,
    imageDayRows,
    userDayRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: startInclusive, lt: endExclusive } },
    }),
    prisma.userBook.count(),
    prisma.book.count({ where: { deletedAt: null } }),
    prisma.book.count({ where: { deletedAt: null, status: "published" } }),
    prisma.query.count(),
    prisma.generatedImage.count(),
    prisma.like.count(),
    prisma.query.count({
      where: { createdAt: { gte: startInclusive, lt: endExclusive } },
    }),
    prisma.generatedImage.count({
      where: { createdAt: { gte: startInclusive, lt: endExclusive } },
    }),
    prisma.query.aggregate({
      _sum: {
        promptTokens: true,
        completionTokens: true,
        embeddingTokens: true,
      },
    }),
    prisma.generatedImage.aggregate({
      _sum: {
        promptTokens: true,
        completionTokens: true,
        embeddingTokens: true,
        subjectTokens: true,
      },
    }),
    prisma.book.aggregate({
      where: { deletedAt: null },
      _sum: {
        ingestionPromptTokens: true,
        ingestionCompletionTokens: true,
      },
    }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT (("createdAt" AT TIME ZONE 'UTC')::date) AS day, COUNT(*)::bigint AS count
      FROM "Query"
      WHERE "createdAt" >= ${startInclusive}
        AND "createdAt" < ${endExclusive}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT (("createdAt" AT TIME ZONE 'UTC')::date) AS day, COUNT(*)::bigint AS count
      FROM "GeneratedImage"
      WHERE "createdAt" >= ${startInclusive}
        AND "createdAt" < ${endExclusive}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT (("createdAt" AT TIME ZONE 'UTC')::date) AS day, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${startInclusive}
        AND "createdAt" < ${endExclusive}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const qp = queryAgg._sum.promptTokens ?? 0;
  const qc = queryAgg._sum.completionTokens ?? 0;
  const qe = queryAgg._sum.embeddingTokens ?? 0;
  const giP = generatedImageAgg._sum.promptTokens ?? 0;
  const giC = generatedImageAgg._sum.completionTokens ?? 0;
  const giE = generatedImageAgg._sum.embeddingTokens ?? 0;
  const giS = generatedImageAgg._sum.subjectTokens ?? 0;
  const ingP = bookIngestAgg._sum.ingestionPromptTokens ?? 0;
  const ingC = bookIngestAgg._sum.ingestionCompletionTokens ?? 0;

  const qaAnthropic = estimateAnthropicUsd(qp, qc);
  const imageAnthropic = estimateAnthropicUsd(giP + giS, giC);
  const embeddingTokensRuntime = qe + giE;
  const embeddingsUsd = estimateOpenAiEmbeddingUsd(embeddingTokensRuntime);
  const genreUsd = estimateGpt4oMiniUsd(ingP, ingC);
  const falUsd = estimateFalImageUsd(totalGeneratedImages);

  const costRowsRaw: Array<{ operation: string; provider: string; estCostUsd: number }> = [
    { operation: "Q&A responses", provider: "Anthropic (est.)", estCostUsd: qaAnthropic },
    { operation: "Image prompt enrichment", provider: "Anthropic (est.)", estCostUsd: imageAnthropic },
    { operation: "Embeddings", provider: "OpenAI (est.)", estCostUsd: embeddingsUsd },
    { operation: "Book ingestion (genre)", provider: "OpenAI (est.)", estCostUsd: genreUsd },
    { operation: "Image generation", provider: "fal.ai (est.)", estCostUsd: falUsd },
  ];

  const totalEstUsd = costRowsRaw.reduce((s, r) => s + r.estCostUsd, 0);
  const costRows = costRowsRaw.map((r) => ({
    ...r,
    estCostFormatted: formatUsd(r.estCostUsd),
  }));

  const queryMap = rowsToDayMap(queryDayRows);
  const imageMap = rowsToDayMap(imageDayRows);
  const userMap = rowsToDayMap(userDayRows);

  const [openaiVendorResult, falVendorResult, neonVendorResult] = await Promise.all([
    fetchOpenAiVendorSnapshot(vendorStartInclusive, vendorEndInclusive),
    fetchFalVendorSnapshot(vendorStartInclusive, vendorEndInclusive),
    fetchNeonVendorSnapshot(vendorStartInclusive, vendorEndInclusive, normalizedVendorDays),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    window: {
      chartStartUtc: startInclusive.toISOString(),
      chartEndInclusiveUtc: endInclusive.toISOString(),
    },
    vendorWindowDays: normalizedVendorDays,
    kpis: {
      totalUsers,
      newUsersLast30Days,
      libraryAddsTotal,
      totalBooks,
      publishedBooks,
      totalQueries,
      totalGeneratedImages,
      totalLikes,
      queriesLast30Days,
      imagesLast30Days,
    },
    charts: {
      queriesByDay: buildDailySeries(startInclusive, endInclusive, queryMap),
      imagesByDay: buildDailySeries(startInclusive, endInclusive, imageMap),
      userGrowthByDay: buildDailySeries(startInclusive, endInclusive, userMap),
    },
    internal: {
      estimatedCosts: {
        rows: costRows,
        totalUsd: totalEstUsd,
        totalFormatted: formatUsd(totalEstUsd),
      },
      footnote: ESTIMATED_COSTS_FOOTNOTE,
    },
    vendors: {
      openai: openaiVendorResult.snapshot,
      fal: falVendorResult.snapshot,
      neon: neonVendorResult.snapshot,
    },
    vendorMessages: {
      openai: openaiVendorResult.errorMessage,
      fal: falVendorResult.errorMessage,
      neon: neonVendorResult.errorMessage,
    },
  };
}
