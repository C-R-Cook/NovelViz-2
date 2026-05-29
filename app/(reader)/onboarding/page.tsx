import { getCurrentUser } from "@/lib/auth";
import {
  findDbProfileForSession,
  getOnboardingRedirectUrl,
  ONBOARDING_PLAN_COOKIE,
  readPlanStepComplete,
} from "@/lib/session-profile";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Legacy /onboarding — redirect to the correct step. */
export default async function OnboardingIndexPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const profile = await findDbProfileForSession(session);
  if (!profile) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const planStepComplete = readPlanStepComplete(
    cookieStore.get(ONBOARDING_PLAN_COOKIE)?.value,
  );
  redirect(getOnboardingRedirectUrl(profile, { planStepComplete }));
}
