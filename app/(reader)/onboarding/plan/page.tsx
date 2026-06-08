import { PlanClient } from "./plan-client";
import { ensureCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { getPublicTierPlans } from "@/lib/tier-limit-config";
import {
  findDbProfileForSession,
  getOnboardingStage,
} from "@/lib/session-profile";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Choose your plan | NovelViz",
};

export default async function OnboardingPlanPage() {
  const session = await ensureCurrentUser();
  if (!session) {
    redirect("/auth/after");
  }

  const profile = await findDbProfileForSession(session);
  if (!profile) {
    redirect("/sign-in");
  }

  const stage = getOnboardingStage(profile);
  if (stage === "complete") {
    redirect(getRoleHomeUrl());
  }
  if (stage === "preferences") {
    redirect("/onboarding/preferences");
  }

  const [initialPlans, creditPackRow] = await Promise.all([
    getPublicTierPlans(),
    prisma.creditPack.findFirst({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        priceFree: true,
        priceStandard: true,
        pricePremium: true,
      },
    }),
  ]);

  return (
    <PlanClient initialPlans={initialPlans} creditPack={creditPackRow} />
  );
}
