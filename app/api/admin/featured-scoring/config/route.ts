import { requireAdminApi } from "@/lib/admin-auth";
import {
  DEFAULT_SCORING_WEIGHTS,
  getScoringWeights,
  historyWeightsFromRow,
  invalidateScoringWeightsCache,
  type ScoringWeights,
} from "@/lib/featured-scoring-config";
import {
  parseScoringWeightsBody,
  serializeScoringConfigResponse,
} from "@/lib/featured-scoring-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const [current, row] = await Promise.all([
    getScoringWeights(),
    prisma.featuredScoringConfig.findUnique({ where: { id: "singleton" } }),
  ]);

  return NextResponse.json(
    serializeScoringConfigResponse({
      current,
      lastUpdatedAt: row?.updatedAt ?? null,
      lastUpdatedBy: row?.updatedBy ?? null,
    }),
  );
}

function weightsToDbData(weights: ScoringWeights) {
  return { ...weights };
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseScoringWeightsBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const displayName =
    admin.user.name?.trim() ||
    admin.user.username?.trim() ||
    admin.user.email;

  const data = weightsToDbData(parsed);

  const row = await prisma.$transaction(async (tx) => {
    const config = await tx.featuredScoringConfig.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        updatedBy: admin.user.id,
        ...data,
      },
      update: {
        updatedBy: admin.user.id,
        ...data,
      },
    });
    await tx.featuredScoringHistory.create({
      data: {
        savedBy: admin.user.id,
        savedByName: displayName,
        ...data,
      },
    });
    return config;
  });

  invalidateScoringWeightsCache();

  return NextResponse.json(
    serializeScoringConfigResponse({
      current: historyWeightsFromRow(row),
      lastUpdatedAt: row.updatedAt,
      lastUpdatedBy: row.updatedBy,
    }),
  );
}
