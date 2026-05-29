"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ONBOARDING_PARTNER_CATALOGUE_NOTE,
  ONBOARDING_PARTNER_PUBLISHER_NAME,
} from "@/lib/partner-request-markers";
import { SubscriptionTier } from "@db";

export type CompletePlanStepInput = {
  tier: "free" | "standard" | "premium";
  partnerInterest?: boolean;
};

export type CompletePlanStepResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completePlanStep(
  input: CompletePlanStepInput,
): Promise<CompletePlanStepResult> {
  const session = await getCurrentUser();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const tierValues: CompletePlanStepInput["tier"][] = ["free", "standard", "premium"];
  if (!tierValues.includes(input.tier)) {
    return { ok: false, error: "Invalid plan" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return { ok: false, error: "User not found" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionTier: input.tier as SubscriptionTier },
  });

  if (input.partnerInterest) {
    const existing = await prisma.partnerRequest.findFirst({
      where: {
        userId: user.id,
        publisherName: { startsWith: "[Onboarding]" },
      },
      select: { id: true },
    });

    if (!existing) {
      const email = user.email.trim();
      const name = user.name?.trim() || email.split("@")[0] || "Reader";
      await prisma.partnerRequest.create({
        data: {
          userId: user.id,
          name,
          email,
          publisherName: ONBOARDING_PARTNER_PUBLISHER_NAME,
          catalogueNote: ONBOARDING_PARTNER_CATALOGUE_NOTE,
        },
      });
    }
  }

  return { ok: true };
}
