import { PlanClient } from "./plan-client";
import { ensureCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import {
  findDbProfileForSession,
  getOnboardingStage,
} from "@/lib/session-profile";
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

  return <PlanClient />;
}
