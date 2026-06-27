import { AuthAfterProvisioning } from "@/app/auth/after/auth-after-provisioning";
import { ensureCurrentUser } from "@/lib/auth";
import { findLegalConsentForSession, tryApplyLegalConsentIntent, userHasRequiredLegalConsent } from "@/lib/legal-consent";
import { tryApplyRegisterUsernameFromIntent } from "@/lib/register-intent";
import { resolvePostAuthRedirect } from "@/lib/session-profile";
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

  let consent = await findLegalConsentForSession(session);
  if (!consent || !userHasRequiredLegalConsent(consent)) {
    // Read username from intent before consent application clears the bridge cookie.
    await tryApplyRegisterUsernameFromIntent(session.id, session.clerkId);

    const applied = await tryApplyLegalConsentIntent(session.id);
    if (!applied) {
      console.warn("[auth/after] legal consent intent was not applied", { userId: session.id });
    }
    consent = await findLegalConsentForSession(session);
  }

  if (!consent || !userHasRequiredLegalConsent(consent)) {
    redirect("/auth/consent");
  }

  await tryApplyRegisterUsernameFromIntent(session.id, session.clerkId);

  redirect(await resolvePostAuthRedirect(session));
}
