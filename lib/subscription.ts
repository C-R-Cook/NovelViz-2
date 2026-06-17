import { getCreditBalance } from "@/lib/credits";
import { applyLimitFloors, ensureLimitFloorsInitialized } from "@/lib/limit-floors";
import { prisma } from "@/lib/prisma";
import { getTierLimitConfig } from "@/lib/tier-limit-config";
import { GrantSource, GrantType, SubscriptionTier, UserRole } from "@db";

/**
 * Beta limit bypass is opt-in: only `BETA_MODE=true` enables it.
 * When the variable is unset, empty, or any other value, beta mode is off (production-safe default).
 */
export function isBetaModeEnabled(): boolean {
  return process.env.BETA_MODE === "true";
}

export const BETA_MODE: boolean = isBetaModeEnabled();

export type EffectiveLimits = {
  queriesPerMonth: number | null;
  imagesPerMonth: number | null;
  models: string[];
  tier: SubscriptionTier;
  creditCostQuery: number;
  creditCostImage: number;
  creditPurchasesEnabled: boolean;
};

export type UsageLimitResult = {
  allowed: boolean;
  used: number;
  limit: number | null;
  resetDate: Date;
  creditBalance: number;
  creditCost: number;
  usesCredits: boolean;
};

export type UsageMeterSnapshot = {
  used: number;
  limit: number | null;
  creditBalance: number;
  percentUsed: number | null;
  unlimited: boolean;
};

/** Serializable usage summary for account / reader UI. */
export type UserUsageSummary = {
  tier: SubscriptionTier;
  tierDisplayName: string;
  subscriptionStatus: string;
  billingAnchorDay: number;
  periodStart: string;
  resetDate: string;
  daysUntilRenewal: number;
  betaMode: boolean;
  creditBalance: number;
  creditPurchasesEnabled: boolean;
  queries: UsageMeterSnapshot;
  images: UsageMeterSnapshot;
};

function meterSnapshot(
  used: number,
  limit: number | null,
  creditBalance: number,
): UsageMeterSnapshot {
  const unlimited = limit === null;
  const percentUsed =
    unlimited || limit === null || limit <= 0 ? null : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, creditBalance, percentUsed, unlimited };
}

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function tierDisplayName(tier: SubscriptionTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Current billing period usage for display (progress bars, renewal countdown). */
export async function getUserUsageSummary(userId: string): Promise<UserUsageSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      usagePeriodAnchor: true,
    },
  });
  if (!user) return null;

  const { periodStart, resetDate } = await resolveBillingPeriod(userId);
  const creditBalance = await getCreditBalance(userId);

  const [queryCheck, imageCheck, limits] = await Promise.all([
    checkUsageLimit(userId, "query"),
    checkUsageLimit(userId, "image"),
    getEffectiveLimits(userId),
  ]);

  return {
    tier: limits.tier,
    tierDisplayName: tierDisplayName(limits.tier),
    subscriptionStatus: user.subscriptionStatus,
    billingAnchorDay: user.usagePeriodAnchor,
    periodStart: periodStart.toISOString(),
    resetDate: resetDate.toISOString(),
    daysUntilRenewal: daysUntil(resetDate),
    betaMode: BETA_MODE,
    creditBalance,
    creditPurchasesEnabled: limits.creditPurchasesEnabled,
    queries: meterSnapshot(queryCheck.used, queryCheck.limit, creditBalance),
    images: meterSnapshot(imageCheck.used, imageCheck.limit, creditBalance),
  };
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.free]: 0,
  [SubscriptionTier.standard]: 1,
  [SubscriptionTier.premium]: 2,
};

function maxTier(a: SubscriptionTier, b: SubscriptionTier): SubscriptionTier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}

function addMonthsUtc(year: number, month: number, day: number, monthsToAdd: number): Date {
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return new Date(Date.UTC(nextYear, nextMonth, clampedDay, 0, 0, 0, 0));
}

/** Billing anchor day 1–28; returns period start at midnight UTC. */
export function getUsagePeriodStart(anchor: number): Date {
  const clampedAnchor = Math.min(28, Math.max(1, anchor));
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();

  if (day >= clampedAnchor) {
    return new Date(Date.UTC(year, month - 1, clampedAnchor, 0, 0, 0, 0));
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return new Date(Date.UTC(prevYear, prevMonth - 1, clampedAnchor, 0, 0, 0, 0));
}

function getResetDate(periodStart: Date, anchor: number): Date {
  const clampedAnchor = Math.min(28, Math.max(1, anchor));
  return addMonthsUtc(
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth() + 1,
    clampedAnchor,
    1,
  );
}

export async function resolveBillingPeriod(userId: string): Promise<{
  periodStart: Date;
  resetDate: Date;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usagePeriodStart: true, usagePeriodAnchor: true },
  });
  const anchor = user?.usagePeriodAnchor ?? 1;
  const periodStart = user?.usagePeriodStart ?? getUsagePeriodStart(anchor);
  const resetDate = user?.usagePeriodStart
    ? addMonthsUtc(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth() + 1,
        periodStart.getUTCDate(),
        1,
      )
    : getResetDate(periodStart, anchor);
  return { periodStart, resetDate };
}

function activeGrantWhere(userId: string, now: Date) {
  return {
    userId,
    startsAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

async function getActiveQuotaOverride(userId: string): Promise<{
  queriesLimit: number | null;
  imagesLimit: number | null;
} | null> {
  const now = new Date();
  const override = await prisma.userQuotaOverride.findFirst({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { queriesLimit: true, imagesLimit: true },
  });
  if (!override) return null;
  return {
    queriesLimit: override.queriesLimit,
    imagesLimit: override.imagesLimit,
  };
}

export async function getEffectiveLimits(userId: string): Promise<EffectiveLimits> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      queriesLimitFloor: true,
      imagesLimitFloor: true,
      queriesUnlimitedFloor: true,
    },
  });
  if (!user) {
    const base = await getTierLimitConfig(SubscriptionTier.standard);
    return {
      queriesPerMonth: base?.queriesPerMonth ?? null,
      imagesPerMonth: base?.imagesPerMonth ?? 50,
      models: base?.allowedModels ?? [],
      tier: SubscriptionTier.standard,
      creditCostQuery: base?.creditCostQuery ?? 1,
      creditCostImage: base?.creditCostImage ?? 3,
      creditPurchasesEnabled: base?.creditPurchasesEnabled ?? false,
    };
  }

  let effectiveTier = user.subscriptionTier;

  await ensureLimitFloorsInitialized(userId, effectiveTier);

  const floorsRow = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      queriesLimitFloor: true,
      imagesLimitFloor: true,
      queriesUnlimitedFloor: true,
    },
  });

  const grants = await prisma.userGrant.findMany({
    where: activeGrantWhere(userId, now),
    select: { grantType: true, tierValue: true, bonusAmount: true },
  });

  for (const grant of grants) {
    if (grant.grantType === GrantType.TIER_UPGRADE && grant.tierValue) {
      effectiveTier = maxTier(effectiveTier, grant.tierValue);
    }
  }

  const tierConfig = await getTierLimitConfig(effectiveTier);
  const globalQueries = tierConfig?.queriesPerMonth ?? null;
  const globalImages = tierConfig?.imagesPerMonth ?? null;
  const floored = applyLimitFloors(globalQueries, globalImages, {
    queriesLimitFloor: floorsRow?.queriesLimitFloor ?? user.queriesLimitFloor,
    imagesLimitFloor: floorsRow?.imagesLimitFloor ?? user.imagesLimitFloor,
    queriesUnlimitedFloor: floorsRow?.queriesUnlimitedFloor ?? user.queriesUnlimitedFloor,
  });
  let queriesPerMonth = floored.queriesPerMonth;
  let imagesPerMonth = floored.imagesPerMonth;
  const models = tierConfig?.allowedModels ?? [];
  const creditCostQuery = tierConfig?.creditCostQuery ?? 1;
  const creditCostImage = tierConfig?.creditCostImage ?? 3;
  const creditPurchasesEnabled = tierConfig?.creditPurchasesEnabled ?? false;

  const override = await getActiveQuotaOverride(userId);
  if (override) {
    if (override.queriesLimit !== null) queriesPerMonth = override.queriesLimit;
    if (override.imagesLimit !== null) imagesPerMonth = override.imagesLimit;
  } else {
    for (const grant of grants) {
      if (grant.grantType === GrantType.QUERY_BONUS && grant.bonusAmount != null) {
        if (queriesPerMonth !== null) {
          queriesPerMonth += grant.bonusAmount;
        }
      }
      if (grant.grantType === GrantType.IMAGE_BONUS && grant.bonusAmount != null) {
        if (imagesPerMonth !== null) {
          imagesPerMonth += grant.bonusAmount;
        }
      }
    }
  }

  return {
    queriesPerMonth,
    imagesPerMonth,
    models: [...models],
    tier: effectiveTier,
    creditCostQuery,
    creditCostImage,
    creditPurchasesEnabled,
  };
}

async function countMonthlyUsage(
  userId: string,
  type: "query" | "image",
  periodStart: Date,
): Promise<number> {
  if (type === "query") {
    return prisma.query.count({
      where: { userId, createdAt: { gte: periodStart } },
    });
  }
  return prisma.generatedImage.count({
    where: { userId, createdAt: { gte: periodStart } },
  });
}

/** Legacy PURCHASE grant top-up balance (migrated users / pre-ledger). */
async function sumLegacyTopUpAvailable(
  userId: string,
  type: "query" | "image",
  now: Date,
): Promise<number> {
  const grantType = type === "query" ? GrantType.QUERY_BONUS : GrantType.IMAGE_BONUS;
  const grants = await prisma.userGrant.findMany({
    where: {
      ...activeGrantWhere(userId, now),
      source: GrantSource.PURCHASE,
      grantType,
    },
    select: { bonusAmount: true, usedAmount: true },
  });

  return grants.reduce((sum, g) => {
    const bonus = g.bonusAmount ?? 0;
    const remaining = Math.max(0, bonus - g.usedAmount);
    return sum + remaining;
  }, 0);
}

export async function checkUsageLimit(
  userId: string,
  type: "query" | "image",
): Promise<UsageLimitResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === UserRole.admin) {
    const { resetDate } = await resolveBillingPeriod(userId);
    return {
      allowed: true,
      used: 0,
      limit: null,
      resetDate,
      creditBalance: 0,
      creditCost: 0,
      usesCredits: false,
    };
  }

  const limits = await getEffectiveLimits(userId);
  const limit = type === "query" ? limits.queriesPerMonth : limits.imagesPerMonth;
  const creditCost = type === "query" ? limits.creditCostQuery : limits.creditCostImage;

  const { periodStart, resetDate } = await resolveBillingPeriod(userId);

  const monthlyUsed = await countMonthlyUsage(userId, type, periodStart);
  const creditBalance = await getCreditBalance(userId);
  const now = new Date();
  const legacyTopUp = await sumLegacyTopUpAvailable(userId, type, now);

  let allowed: boolean;
  let usesCredits = false;

  if (limit === null) {
    allowed = true;
  } else if (monthlyUsed < limit) {
    allowed = true;
  } else if (creditBalance >= creditCost) {
    allowed = true;
    usesCredits = true;
  } else if (legacyTopUp > 0) {
    allowed = true;
    usesCredits = true;
  } else {
    allowed = false;
  }

  if (BETA_MODE) {
    allowed = true;
    usesCredits = false;
  }

  return {
    allowed,
    used: monthlyUsed,
    limit,
    resetDate,
    creditBalance,
    creditCost,
    usesCredits,
  };
}

/** @deprecated Use spendCreditsIfNeeded from lib/credits.ts */
export async function consumeTopUp(userId: string, type: "query" | "image"): Promise<void> {
  try {
    const limits = await getEffectiveLimits(userId);
    const limit = type === "query" ? limits.queriesPerMonth : limits.imagesPerMonth;
    const creditCost = type === "query" ? limits.creditCostQuery : limits.creditCostImage;

    const { periodStart } = await resolveBillingPeriod(userId);
    const monthlyUsed = await countMonthlyUsage(userId, type, periodStart);

    if (limit === null || monthlyUsed <= limit) {
      return;
    }

    const balance = await getCreditBalance(userId);
    if (balance >= creditCost) {
      const { spendCreditsIfNeeded } = await import("@/lib/credits");
      await spendCreditsIfNeeded({
        userId,
        type,
        bookId: "",
        monthlyUsed,
        monthlyLimit: limit,
        creditCost,
      });
      return;
    }

    const grantType = type === "query" ? GrantType.QUERY_BONUS : GrantType.IMAGE_BONUS;
    const now = new Date();
    const grants = await prisma.userGrant.findMany({
      where: {
        ...activeGrantWhere(userId, now),
        source: GrantSource.PURCHASE,
        grantType,
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, bonusAmount: true, usedAmount: true },
    });

    for (const grant of grants) {
      const bonus = grant.bonusAmount ?? 0;
      if (grant.usedAmount < bonus) {
        await prisma.userGrant.update({
          where: { id: grant.id },
          data: { usedAmount: { increment: 1 } },
        });
        return;
      }
    }

    console.warn("[subscription] consumeTopUp: no balance", { userId, type });
  } catch (err) {
    console.error("[subscription] consumeTopUp error", err);
  }
}

export async function consumeUsageAfterSuccess(
  userId: string,
  type: "query" | "image",
  bookId: string,
): Promise<void> {
  const limits = await getEffectiveLimits(userId);
  const limit = type === "query" ? limits.queriesPerMonth : limits.imagesPerMonth;
  const creditCost = type === "query" ? limits.creditCostQuery : limits.creditCostImage;
  const { periodStart } = await resolveBillingPeriod(userId);
  const monthlyUsed = await countMonthlyUsage(userId, type, periodStart);

  if (limit === null || monthlyUsed <= limit) {
    return;
  }

  const balance = await getCreditBalance(userId);
  if (balance >= creditCost) {
    const { spendCreditsIfNeeded } = await import("@/lib/credits");
    await spendCreditsIfNeeded({
      userId,
      type,
      bookId,
      monthlyUsed,
      monthlyLimit: limit,
      creditCost,
    });
    return;
  }

  await consumeTopUp(userId, type);
}
