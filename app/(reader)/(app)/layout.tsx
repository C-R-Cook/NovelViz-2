import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import {
  findDbProfileForSession,
  getOnboardingRedirectUrl,
  ONBOARDING_PLAN_COOKIE,
  profileNeedsOnboarding,
  readPlanStepComplete,
} from "@/lib/session-profile";
import { DEV_USERS_BY_ID } from "@/lib/dev-users";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Reader app routes: Nav + completed profile required. Onboarding lives outside (app). */
export default async function ReaderAppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const profile = await findDbProfileForSession(session);

  // Dev users defined in DEV_USERS_BY_ID may not have real DB rows.
  // In that case, synthesize a "complete" profile so they skip onboarding.
  const resolvedProfile =
    profile ??
    (process.env.NODE_ENV !== "production" && DEV_USERS_BY_ID[session.id]
      ? {
          id: session.id,
          username: session.username ?? session.id,
          genrePreferences: ["fiction"],
        }
      : null);

  if (!resolvedProfile) {
    redirect("/sign-in");
  }
  const cookieStore = await cookies();
  const planStepComplete = readPlanStepComplete(
    cookieStore.get(ONBOARDING_PLAN_COOKIE)?.value,
  );
  if (profileNeedsOnboarding(resolvedProfile, { planStepComplete })) {
    redirect(getOnboardingRedirectUrl(resolvedProfile, { planStepComplete }));
  }

  return (
    <>
      <Nav />
      <main className="flex-1 pt-[calc(3.5rem+0.25rem)]">{children}</main>
    </>
  );
}
