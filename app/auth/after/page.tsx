import { AuthAfterProvisioning } from "@/app/auth/after/auth-after-provisioning";
import { ensureCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, getPostAuthRedirectUrl } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Post–Clerk sign-in: provision DB user if needed, then route to onboarding or library. */
export default async function AuthAfterPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const session = await ensureCurrentUser();
  if (!session) {
    return <AuthAfterProvisioning />;
  }

  const profile = await findDbProfileForSession(session);
  redirect(getPostAuthRedirectUrl(profile));
}
