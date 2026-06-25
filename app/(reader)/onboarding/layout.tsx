import { ensureCurrentUser } from "@/lib/auth";
import { enforceAccountAccessForPage } from "@/lib/account-status-routing";
import { getLegalConsentRedirectIfNeeded } from "@/lib/legal-consent";
import { redirect } from "next/navigation";
import "./onboarding.css";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await enforceAccountAccessForPage();

  const session = await ensureCurrentUser();
  if (session) {
    const consentRedirect = await getLegalConsentRedirectIfNeeded(session);
    if (consentRedirect) {
      redirect(consentRedirect);
    }
  }

  return <div className="onboarding-root">{children}</div>;
}
