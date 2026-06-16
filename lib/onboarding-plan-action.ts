"use server";

import { ensureCurrentUser } from "@/lib/auth";
import {
  AdminEmailCategory,
  sendAdminEmail,
} from "@/lib/admin-email";
import { establishLimitFloorsForTier } from "@/lib/limit-floors";
import { ONBOARDING_PLAN_COOKIE } from "@/lib/onboarding-cookies";
import { prisma } from "@/lib/prisma";
import {
  ONBOARDING_PARTNER_CATALOGUE_NOTE,
  ONBOARDING_PARTNER_PUBLISHER_NAME,
} from "@/lib/partner-request-markers";
import { SubscriptionTier } from "@db";
import { cookies } from "next/headers";

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
  const session = await ensureCurrentUser();
  if (!session) {
    return { ok: false, error: "Unauthorized — please refresh and try again." };
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

  await establishLimitFloorsForTier(user.id, input.tier as SubscriptionTier);

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

      sendAdminEmail({
        category: AdminEmailCategory.PARTNER_REQUEST,
        subjectDetail: `${ONBOARDING_PARTNER_PUBLISHER_NAME} - ${name}`,
        bodyLines: [
          { label: "Source", value: "Onboarding" },
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Publisher / imprint", value: ONBOARDING_PARTNER_PUBLISHER_NAME },
          { label: "Catalogue", value: ONBOARDING_PARTNER_CATALOGUE_NOTE },
        ],
      });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_PLAN_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  });

  return { ok: true };
}
