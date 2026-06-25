import { AuthAfterProvisioning } from "@/app/auth/after/auth-after-provisioning";
import { ensureCurrentUser } from "@/lib/auth";
import { findLegalConsentForSession, userHasRequiredLegalConsent } from "@/lib/legal-consent";
import {
  findDbProfileForSession,
  getPostAuthRedirectUrl,
} from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Post–Clerk sign-in: provision DB user if needed, then route to consent, onboarding, or library. */
export default async function AuthAfterPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const session = await ensureCurrentUser();
  if (!session) {
    return <AuthAfterProvisioning fullPage />;
  }

  const consent = await findLegalConsentForSession(session);
  if (!consent || !userHasRequiredLegalConsent(consent)) {
    redirect("/auth/consent");
  }

  const profile = await findDbProfileForSession(session);
  redirect(getPostAuthRedirectUrl(profile));
}
