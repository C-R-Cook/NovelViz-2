import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const overrides = await prisma.userQuotaOverride.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    overrides: overrides.map((o) => ({
      ...o,
      expiresAt: o.expiresAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  let queriesLimit: number | null = null;
  let imagesLimit: number | null = null;

  if ("queriesLimit" in body) {
    const v = body.queriesLimit;
    if (v !== null) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "queriesLimit must be null or non-negative integer" }, { status: 400 });
      }
      queriesLimit = n;
    }
  }
  if ("imagesLimit" in body) {
    const v = body.imagesLimit;
    if (v !== null) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "imagesLimit must be null or non-negative integer" }, { status: 400 });
      }
      imagesLimit = n;
    }
  }

  if (queriesLimit === null && imagesLimit === null) {
    return NextResponse.json({ error: "Set at least one of queriesLimit or imagesLimit" }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    if (typeof body.expiresAt !== "string") {
      return NextResponse.json({ error: "expiresAt must be ISO string or null" }, { status: 400 });
    }
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    expiresAt = parsed;
  }

  const override = await prisma.userQuotaOverride.create({
    data: {
      userId,
      queriesLimit,
      imagesLimit,
      expiresAt,
      reason,
      grantedBy: auth.user.id,
    },
  });

  return NextResponse.json({
    override: {
      ...override,
      expiresAt: override.expiresAt?.toISOString() ?? null,
      createdAt: override.createdAt.toISOString(),
    },
  });
}
