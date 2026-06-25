import { AuthConsentClient } from "@/app/auth/consent/consent-client";
import { ensureCurrentUser } from "@/lib/auth";
import {
  clearLegalConsentIntentCookie,
  findLegalConsentForSession,
  isLegalConsentIntentValid,
  readLegalConsentIntentCookie,
  recordLegalConsent,
  userHasRequiredLegalConsent,
} from "@/lib/legal-consent";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AuthConsentPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/register");
  }

  const session = await ensureCurrentUser();
  if (!session) {
    redirect("/auth/after");
  }

  const consent = await findLegalConsentForSession(session);
  if (consent && userHasRequiredLegalConsent(consent)) {
    redirect("/auth/after");
  }

  const intent = await readLegalConsentIntentCookie();
  if (isLegalConsentIntentValid(intent)) {
    await recordLegalConsent(session.id);
    await clearLegalConsentIntentCookie();
    redirect("/auth/after");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-6">
      <AuthConsentClient />
    </div>
  );
}
