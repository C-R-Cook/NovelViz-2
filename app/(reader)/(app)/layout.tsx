import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import {
  findDbProfileForSession,
  getOnboardingRedirectUrl,
  ONBOARDING_PLAN_COOKIE,
  profileNeedsOnboarding,
  readPlanStepComplete,
} from "@/lib/session-profile";
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
  if (!profile) {
    redirect("/sign-in");
  }
  const cookieStore = await cookies();
  const planStepComplete = readPlanStepComplete(
    cookieStore.get(ONBOARDING_PLAN_COOKIE)?.value,
  );
  if (profileNeedsOnboarding(profile, { planStepComplete })) {
    redirect(getOnboardingRedirectUrl(profile, { planStepComplete }));
  }

  return (
    <>
      <Nav />
      <main className="flex-1 pt-[calc(3.5rem+0.25rem)]">{children}</main>
    </>
  );
}
