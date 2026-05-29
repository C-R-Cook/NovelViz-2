import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionProfileRow = {
  id: string;
  username: string | null;
  genrePreferences: string[];
};

export type OnboardingStage = "plan" | "preferences" | "complete";

const profileSelect = {
  id: true,
  username: true,
  genrePreferences: true,
} as const;

/** DB profile for a session user (Clerk or dev identity). */
export async function findDbProfileForSession(
  session: CurrentUser,
): Promise<SessionProfileRow | null> {
  const byClerk = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
    select: profileSelect,
  });
  if (byClerk) return byClerk;

  return prisma.user.findUnique({
    where: { id: session.id },
    select: profileSelect,
  });
}

export type OnboardingStageOptions = {
  /** Set when user finished /onboarding/plan (cookie); allows preferences before username exists. */
  planStepComplete?: boolean;
};

export function getOnboardingStage(
  profile: SessionProfileRow | null,
  options?: OnboardingStageOptions,
): OnboardingStage {
  if (!profile?.genrePreferences?.length) {
    if (!profile?.username?.trim()) {
      return options?.planStepComplete ? "preferences" : "plan";
    }
    return "preferences";
  }
  if (!profile?.username?.trim()) {
    return options?.planStepComplete ? "preferences" : "plan";
  }
  return "complete";
}

export function profileNeedsOnboarding(
  profile: SessionProfileRow | null,
  options?: OnboardingStageOptions,
): boolean {
  return getOnboardingStage(profile, options) !== "complete";
}

export function getOnboardingRedirectUrl(
  profile: SessionProfileRow | null,
  options?: OnboardingStageOptions,
): string {
  switch (getOnboardingStage(profile, options)) {
    case "plan":
      return "/onboarding/plan";
    case "preferences":
      return "/onboarding/preferences";
    default:
      return "/library";
  }
}

/** Where to send someone after Clerk sign-in / sign-up. */
export function getPostAuthRedirectUrl(profile: SessionProfileRow | null): string {
  return getOnboardingRedirectUrl(profile, { planStepComplete: false });
}

export { ONBOARDING_PLAN_COOKIE } from "@/lib/onboarding-cookies";

export function readPlanStepComplete(cookieValue: string | undefined): boolean {
  return cookieValue === "1";
}
