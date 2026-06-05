import { prisma } from "@/lib/prisma";
import type { TierLimitConfig } from "@db";
import { SubscriptionTier } from "@db";

const CACHE_TTL_MS = 30_000;

type CacheEntry = { data: TierLimitConfig[]; expiresAt: number };

let cache: CacheEntry | null = null;

export async function getAllTierLimitConfigs(): Promise<TierLimitConfig[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.data;
  }
  const rows = await prisma.tierLimitConfig.findMany({
    orderBy: { tier: "asc" },
  });
  cache = { data: rows, expiresAt: now + CACHE_TTL_MS };
  return rows;
}

export function invalidateTierLimitConfigCache(): void {
  cache = null;
}

export async function getTierLimitConfig(tier: SubscriptionTier): Promise<TierLimitConfig | null> {
  const all = await getAllTierLimitConfigs();
  return all.find((r) => r.tier === tier) ?? null;
}

export type PublicTierPlan = {
  tier: SubscriptionTier;
  name: string;
  displayPriceMonthly: string | null;
  queriesPerMonth: number | null;
  imagesPerMonth: number | null;
  allowedModels: string[];
  creditPurchasesEnabled: boolean;
};

function tierDisplayName(tier: SubscriptionTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export async function getPublicTierPlans(): Promise<PublicTierPlan[]> {
  const rows = await getAllTierLimitConfigs();
  return rows.map((r) => ({
    tier: r.tier,
    name: tierDisplayName(r.tier),
    displayPriceMonthly: r.displayPriceMonthly,
    queriesPerMonth: r.queriesPerMonth,
    imagesPerMonth: r.imagesPerMonth,
    allowedModels: r.allowedModels,
    creditPurchasesEnabled: r.creditPurchasesEnabled,
  }));
}
