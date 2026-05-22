import { AuthAfterClient } from "@/app/auth/after/auth-after-client";
import { getCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, getPostAuthRedirectUrl } from "@/lib/session-profile";
import { redirect } from "next/navigation";

/** Post–Clerk sign-in: pick library vs onboarding and clear dev impersonation. */
export default async function AuthAfterPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }

  const profile = await findDbProfileForSession(session);
  const redirectTo = getPostAuthRedirectUrl(profile);

  return <AuthAfterClient redirectTo={redirectTo} />;
}
