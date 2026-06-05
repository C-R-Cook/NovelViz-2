import { prisma } from "@/lib/prisma";
import { getTierLimitConfig } from "@/lib/tier-limit-config";
import { SubscriptionTier } from "@db";

export type UserLimitFloors = {
  queriesLimitFloor: number | null;
  imagesLimitFloor: number | null;
  queriesUnlimitedFloor: boolean;
};

/**
 * Effective limit for a user: global increases apply; global decreases do not
 * reduce below the user's established floor.
 */
export function resolveLimitWithFloor(
  global: number | null,
  floor: number | null,
  unlimitedFloor: boolean,
): number | null {
  if (unlimitedFloor) return null;
  if (global === null) return null;
  if (floor === null) return global;
  return Math.max(floor, global);
}

export function applyLimitFloors(
  globalQueries: number | null,
  globalImages: number | null,
  floors: UserLimitFloors,
): { queriesPerMonth: number | null; imagesPerMonth: number | null } {
  return {
    queriesPerMonth: resolveLimitWithFloor(
      globalQueries,
      floors.queriesLimitFloor,
      floors.queriesUnlimitedFloor,
    ),
    imagesPerMonth: resolveLimitWithFloor(globalImages, floors.imagesLimitFloor, false),
  };
}

/** Snapshot current tier globals onto the user (new tier contract). */
export async function establishLimitFloorsForTier(
  userId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const config = await getTierLimitConfig(tier);
  const queries = config?.queriesPerMonth ?? null;
  const images = config?.imagesPerMonth ?? null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      queriesLimitFloor: queries,
      imagesLimitFloor: images,
      queriesUnlimitedFloor: queries === null,
    },
  });
}

/** Set floors only when not yet established (signup / legacy backfill). */
export async function ensureLimitFloorsInitialized(
  userId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      queriesLimitFloor: true,
      imagesLimitFloor: true,
      queriesUnlimitedFloor: true,
    },
  });
  if (!user) return;

  const hasFloors =
    user.queriesUnlimitedFloor ||
    user.queriesLimitFloor !== null ||
    user.imagesLimitFloor !== null;
  if (hasFloors) return;

  await establishLimitFloorsForTier(userId, tier);
}
