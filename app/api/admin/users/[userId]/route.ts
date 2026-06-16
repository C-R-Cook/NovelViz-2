import { requireAdminApi } from "@/lib/admin-auth";
import { BADGES, getBadgeDefinition } from "@/lib/badges";
import { DeleteUserError, deleteUserCompletely } from "@/lib/delete-user";
import { prisma } from "@/lib/prisma";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { establishLimitFloorsForTier } from "@/lib/limit-floors";
import { checkUsageLimit, getEffectiveLimits, resolveBillingPeriod } from "@/lib/subscription";
import { SubscriptionTier } from "@db";
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
      queriesLimitFloor: true,
      imagesLimitFloor: true,
      queriesUnlimitedFloor: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { periodStart, resetDate } = await resolveBillingPeriod(userId);
  const limitSnapshot = await checkUsageLimit(userId, "query");

  const [activeGrants, badgeRows, queriesThisPeriod, imagesThisPeriod, effectiveLimits, creditBalance, creditTransactions, quotaOverrides, allTimeQueries, allTimeImages, ownedBooks] =
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
      getCreditBalance(userId),
      getCreditTransactions(userId, { limit: 50 }),
      prisma.userQuotaOverride.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.query.count({ where: { userId } }),
      prisma.generatedImage.count({ where: { userId } }),
      prisma.book.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { id: true, title: true, author: true, status: true },
        orderBy: { title: "asc" },
      }),
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
      allTimeQueries,
      allTimeImages,
      effectiveLimits,
      limitFloors: {
        queriesLimitFloor: user.queriesLimitFloor,
        imagesLimitFloor: user.imagesLimitFloor,
        queriesUnlimitedFloor: user.queriesUnlimitedFloor,
      },
      periodStart: periodStart.toISOString(),
      resetDate: resetDate.toISOString(),
      creditBalance,
    },
    creditTransactions: creditTransactions.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
    quotaOverrides: quotaOverrides.map((o) => ({
      ...o,
      expiresAt: o.expiresAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
    ownedBooks,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("subscriptionTier" in body) {
    const tier = body.subscriptionTier;
    if (tier !== "free" && tier !== "standard" && tier !== "premium") {
      return NextResponse.json({ error: "Invalid subscriptionTier" }, { status: 400 });
    }
    data.subscriptionTier = tier as SubscriptionTier;
  }
  if ("subscriptionStatus" in body) {
    const status = body.subscriptionStatus;
    if (status !== "active" && status !== "cancelled" && status !== "past_due" && status !== "trialing") {
      return NextResponse.json({ error: "Invalid subscriptionStatus" }, { status: 400 });
    }
    data.subscriptionStatus = status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: data as Parameters<typeof prisma.user.update>[0]["data"],
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionStatus: true,
    },
  });

  if ("subscriptionTier" in data && typeof data.subscriptionTier === "string") {
    await establishLimitFloorsForTier(userId, data.subscriptionTier as SubscriptionTier);
  }

  return NextResponse.json({ user });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;

  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account from the admin panel. Use account settings instead." },
      { status: 403 },
    );
  }

  try {
    await deleteUserCompletely(userId, { preventLastAdmin: true });
  } catch (err) {
    if (err instanceof DeleteUserError) {
      const status =
        err.code === "not_found" ? 404 : err.code === "last_admin" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[api/admin/users] DELETE failed", err);
    return NextResponse.json({ error: "Could not delete user" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
