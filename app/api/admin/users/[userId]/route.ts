import { requireAdminApi } from "@/lib/admin-auth";
import { BADGES, getBadgeDefinition } from "@/lib/badges";
import { prisma } from "@/lib/prisma";
import { checkUsageLimit, getEffectiveLimits, getUsagePeriodStart } from "@/lib/subscription";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      clerkId: true,
      username: true,
      name: true,
      email: true,
      role: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      usagePeriodAnchor: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const periodStart = getUsagePeriodStart(user.usagePeriodAnchor);
  const limitSnapshot = await checkUsageLimit(userId, "query");

  const [activeGrants, badgeRows, queriesThisPeriod, imagesThisPeriod, effectiveLimits] =
    await Promise.all([
      prisma.userGrant.findMany({
        where: {
          userId,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userBadge.findMany({ where: { userId } }),
      prisma.query.count({ where: { userId, createdAt: { gte: periodStart } } }),
      prisma.generatedImage.count({ where: { userId, createdAt: { gte: periodStart } } }),
      getEffectiveLimits(userId),
    ]);

  const badgeByKey = new Map(badgeRows.map((b) => [b.badgeKey, b]));
  const allBadges = Object.keys(BADGES).map((badgeKey) => {
    const row = badgeByKey.get(badgeKey);
    const def = getBadgeDefinition(badgeKey);
    return {
      badgeKey,
      name: def?.name ?? badgeKey,
      description: def?.description ?? "",
      awarded: !!row,
      awardedAt: row?.awardedAt.toISOString(),
      awardedBy: row?.awardedBy ?? undefined,
      note: row?.note ?? undefined,
    };
  });

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
    activeGrants: activeGrants.map((g) => ({
      ...g,
      startsAt: g.startsAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
    allBadges,
    usage: {
      queriesThisPeriod,
      imagesThisPeriod,
      effectiveLimits,
      periodStart: periodStart.toISOString(),
      resetDate: limitSnapshot.resetDate.toISOString(),
    },
  });
}
