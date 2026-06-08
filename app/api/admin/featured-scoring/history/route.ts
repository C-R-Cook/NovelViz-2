import { requireAdminApi } from "@/lib/admin-auth";
import {
  DEFAULT_SCORING_WEIGHTS,
  historyWeightsFromRow,
  type ScoringWeights,
} from "@/lib/featured-scoring-config";
import { diffScoringWeights } from "@/lib/scoring-field-labels";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseYearMonth(searchParams: URLSearchParams): { year: number; month: number } | null {
  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : NaN;
  const month = monthRaw ? Number.parseInt(monthRaw, 10) : NaN;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const parsed = parseYearMonth(new URL(request.url).searchParams);
  if (!parsed) {
    return NextResponse.json({ error: "year and month (1–12) are required" }, { status: 400 });
  }

  const start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const end = new Date(Date.UTC(parsed.year, parsed.month, 1));

  const [monthRows, priorRow] = await Promise.all([
    prisma.featuredScoringHistory.findMany({
      where: { savedAt: { gte: start, lt: end } },
      orderBy: { savedAt: "asc" },
    }),
    prisma.featuredScoringHistory.findFirst({
      where: { savedAt: { lt: start } },
      orderBy: { savedAt: "desc" },
    }),
  ]);

  const baseline: ScoringWeights = priorRow
    ? historyWeightsFromRow(priorRow)
    : { ...DEFAULT_SCORING_WEIGHTS };

  let previous = baseline;
  const flat = monthRows.map((row) => {
    const weights = historyWeightsFromRow(row);
    const diff = diffScoringWeights(previous, weights);
    previous = weights;
    return {
      id: row.id,
      savedAt: row.savedAt.toISOString(),
      savedByName: row.savedByName,
      weights,
      diff,
    };
  });

  const byDate = new Map<string, typeof flat>();
  for (const entry of flat) {
    const date = entry.savedAt.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }

  const entries = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, changes]) => ({ date, changes }));

  return NextResponse.json({ entries });
}
