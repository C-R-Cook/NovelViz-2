import { ClerkThemedSignUp } from "@/components/clerk-themed-auth";
import { getCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, getPostAuthRedirectUrl } from "@/lib/session-profile";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await getCurrentUser();
  if (session) {
    const profile = await findDbProfileForSession(session);
    redirect(getPostAuthRedirectUrl(profile));
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-base p-6">
      <ClerkThemedSignUp
        path="/register"
        routing="path"
        signInUrl="/login"
        forceRedirectUrl="/auth/after"
        fallbackRedirectUrl="/auth/after"
      />
    </div>
  );
}
