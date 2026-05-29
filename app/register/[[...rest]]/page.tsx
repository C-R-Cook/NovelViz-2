import { ClerkThemedSignUp } from "@/components/clerk-themed-auth";
import { ensureCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, getPostAuthRedirectUrl } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const { userId } = await auth();
  if (userId) {
    const session = await ensureCurrentUser();
    if (session) {
      const profile = await findDbProfileForSession(session);
      redirect(getPostAuthRedirectUrl(profile));
    }
    redirect("/auth/after");
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
