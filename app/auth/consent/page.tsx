import { AuthConsentClient } from "@/app/auth/consent/consent-client";
import { ensureCurrentUser } from "@/lib/auth";
import { DEV_USERS_BY_ID } from "@/lib/dev-users";
import {
  clearLegalConsentIntentCookie,
  findLegalConsentForSession,
  isLegalConsentIntentValid,
  readLegalConsentIntentCookie,
  recordLegalConsent,
  userHasRequiredLegalConsent,
} from "@/lib/legal-consent";
import { redirect } from "next/navigation";

function redirectAfterConsent(session: { id: string }) {
  if (process.env.NODE_ENV !== "production" && DEV_USERS_BY_ID[session.id]) {
    redirect("/library");
  }
  redirect("/auth/after");
}

export default async function AuthConsentPage() {
  const session = await ensureCurrentUser();
  if (!session) {
    redirect("/login");
  }

  const consent = await findLegalConsentForSession(session);
  if (consent && userHasRequiredLegalConsent(consent)) {
    redirectAfterConsent(session);
  }

  const intent = await readLegalConsentIntentCookie();
  if (isLegalConsentIntentValid(intent)) {
    await recordLegalConsent(session.id);
    await clearLegalConsentIntentCookie();
    redirectAfterConsent(session);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-6">
      <AuthConsentClient />
    </div>
  );
}
