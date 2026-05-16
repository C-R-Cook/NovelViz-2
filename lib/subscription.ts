import { prisma } from "@/lib/prisma";
import { GrantSource, GrantType, SubscriptionTier } from "@db";

export const BETA_MODE: boolean = process.env.BETA_MODE === "true";

const GROK_ENDPOINT = "xai/grok-imagine-image";
const SEEDREAM_ENDPOINT = "fal-ai/bytedance/seedream/v4.5/text-to-image";

export const TIER_CONFIG = {
  free: {
    queriesPerMonth: null as number | null,
    imagesPerMonth: 5,
    models: [GROK_ENDPOINT],
  },
  standard: {
    queriesPerMonth: null as number | null,
    imagesPerMonth: 50,
    models: [GROK_ENDPOINT],
  },
  premium: {
    queriesPerMonth: null as number | null,
    imagesPerMonth: 150,
    models: [GROK_ENDPOINT, SEEDREAM_ENDPOINT],
  },
} as const;

export type EffectiveLimits = {
  queriesPerMonth: number | null;
  imagesPerMonth: number | null;
  models: string[];
  tier: SubscriptionTier;
};

export type UsageLimitResult = {
  allowed: boolean;
  used: number;
  limit: number | null;
  resetDate: Date;
  topUpAvailable: number;
};

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

function activeGrantWhere(userId: string, now: Date) {
  return {
    userId,
    startsAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export async function getEffectiveLimits(userId: string): Promise<EffectiveLimits> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });
  if (!user) {
    const base = TIER_CONFIG.standard;
    return {
      queriesPerMonth: base.queriesPerMonth,
      imagesPerMonth: base.imagesPerMonth,
      models: [...base.models],
      tier: SubscriptionTier.standard,
    };
  }

  let effectiveTier = user.subscriptionTier;
  const base = TIER_CONFIG[effectiveTier];
  let queriesPerMonth = base.queriesPerMonth;
  let imagesPerMonth = base.imagesPerMonth;

  const grants = await prisma.userGrant.findMany({
    where: activeGrantWhere(userId, now),
    select: { grantType: true, tierValue: true, bonusAmount: true },
  });

  for (const grant of grants) {
    if (grant.grantType === GrantType.TIER_UPGRADE && grant.tierValue) {
      effectiveTier = maxTier(effectiveTier, grant.tierValue);
    }
  }

  const tierConfig = TIER_CONFIG[effectiveTier];
  queriesPerMonth = tierConfig.queriesPerMonth;
  imagesPerMonth = tierConfig.imagesPerMonth;

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

  return {
    queriesPerMonth,
    imagesPerMonth,
    models: [...tierConfig.models],
    tier: effectiveTier,
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

async function sumTopUpAvailable(
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
  const limits = await getEffectiveLimits(userId);
  const limit = type === "query" ? limits.queriesPerMonth : limits.imagesPerMonth;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usagePeriodAnchor: true },
  });
  const anchor = user?.usagePeriodAnchor ?? 1;
  const periodStart = getUsagePeriodStart(anchor);
  const resetDate = getResetDate(periodStart, anchor);
  const now = new Date();

  const monthlyUsed = await countMonthlyUsage(userId, type, periodStart);
  const topUpAvailable = await sumTopUpAvailable(userId, type, now);

  let allowed: boolean;
  if (limit === null) {
    allowed = true;
  } else if (monthlyUsed < limit) {
    allowed = true;
  } else if (topUpAvailable > 0) {
    allowed = true;
  } else {
    allowed = false;
  }

  if (BETA_MODE) {
    allowed = true;
  }

  return {
    allowed,
    used: monthlyUsed,
    limit,
    resetDate,
    topUpAvailable,
  };
}

export async function consumeTopUp(userId: string, type: "query" | "image"): Promise<void> {
  try {
    const limits = await getEffectiveLimits(userId);
    const limit = type === "query" ? limits.queriesPerMonth : limits.imagesPerMonth;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { usagePeriodAnchor: true },
    });
    const anchor = user?.usagePeriodAnchor ?? 1;
    const periodStart = getUsagePeriodStart(anchor);
    const monthlyUsed = await countMonthlyUsage(userId, type, periodStart);

    if (limit === null || monthlyUsed <= limit) {
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

    console.warn("[subscription] consumeTopUp: no PURCHASE grant balance", { userId, type });
  } catch (err) {
    console.error("[subscription] consumeTopUp error", err);
  }
}
