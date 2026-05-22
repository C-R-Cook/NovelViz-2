import { OnboardingClient } from "./onboarding-client";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { findDbProfileForSession, profileNeedsOnboarding } from "@/lib/session-profile";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Welcome | NovelViz",
};

export default async function OnboardingPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const profile = await findDbProfileForSession(session);
  if (!profile) {
    redirect("/sign-in");
  }
  if (!profileNeedsOnboarding(profile)) {
    redirect(getRoleHomeUrl());
  }

  return <OnboardingClient />;
}
