import { PreferencesClient } from "./preferences-client";
import { ensureCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import {
  findDbProfileForSession,
  getOnboardingStage,
  ONBOARDING_PLAN_COOKIE,
  readPlanStepComplete,
} from "@/lib/session-profile";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Your preferences | NovelViz",
};

export default async function OnboardingPreferencesPage() {
  const session = await ensureCurrentUser();
  if (!session) {
    redirect("/auth/after");
  }

  const profile = await findDbProfileForSession(session);
  if (!profile) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const planStepComplete = readPlanStepComplete(
    cookieStore.get(ONBOARDING_PLAN_COOKIE)?.value,
  );
  const stage = getOnboardingStage(profile, { planStepComplete });
  if (stage === "complete") {
    redirect(getRoleHomeUrl());
  }
  if (stage === "plan") {
    redirect("/onboarding/plan");
  }

  const initialUsername = profile.username?.trim() ?? "";

  return <PreferencesClient initialUsername={initialUsername} legacyGenresOnly={Boolean(initialUsername)} />;
}
