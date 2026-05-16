import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { GrantSource, GrantType, SubscriptionTier } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const grantType = b.grantType;
  if (
    grantType !== GrantType.TIER_UPGRADE &&
    grantType !== GrantType.QUERY_BONUS &&
    grantType !== GrantType.IMAGE_BONUS
  ) {
    return NextResponse.json({ error: "Invalid grantType" }, { status: 400 });
  }

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  let tierValue: SubscriptionTier | null = null;
  let bonusAmount: number | null = null;

  if (grantType === GrantType.TIER_UPGRADE) {
    const tv = b.tierValue;
    if (tv !== "free" && tv !== "standard" && tv !== "premium") {
      return NextResponse.json({ error: "tierValue is required for TIER_UPGRADE" }, { status: 400 });
    }
    tierValue = tv as SubscriptionTier;
  } else {
    const amt = typeof b.bonusAmount === "number" ? b.bonusAmount : Number.parseInt(String(b.bonusAmount), 10);
    if (!Number.isFinite(amt) || amt < 1) {
      return NextResponse.json({ error: "bonusAmount must be a positive integer" }, { status: 400 });
    }
    bonusAmount = Math.trunc(amt);
  }

  let expiresAt: Date | null = null;
  if (b.expiresAt !== undefined && b.expiresAt !== null) {
    if (typeof b.expiresAt !== "string") {
      return NextResponse.json({ error: "expiresAt must be an ISO date string or null" }, { status: 400 });
    }
    const parsed = new Date(b.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    expiresAt = parsed;
  }

  const grant = await prisma.userGrant.create({
    data: {
      userId,
      grantType,
      source: GrantSource.ADMIN,
      tierValue,
      bonusAmount,
      reason,
      grantedBy: auth.user.clerkId,
      expiresAt,
    },
  });

  return NextResponse.json({
    grant: {
      ...grant,
      startsAt: grant.startsAt.toISOString(),
      expiresAt: grant.expiresAt?.toISOString() ?? null,
      createdAt: grant.createdAt.toISOString(),
    },
  });
}
