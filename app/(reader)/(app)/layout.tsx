import { getCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, profileNeedsOnboarding } from "@/lib/session-profile";
import { redirect } from "next/navigation";

/** Reader routes that require a completed profile (username). Onboarding lives outside this group. */
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
  if (profileNeedsOnboarding(profile)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
