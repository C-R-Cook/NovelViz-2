import { ClerkThemedSignIn } from "@/components/clerk-themed-auth";
import { ensureCurrentUser } from "@/lib/auth";
import { resolvePostAuthRedirect } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const { userId } = await auth();
  if (userId) {
    const session = await ensureCurrentUser();
    if (session) {
      redirect(await resolvePostAuthRedirect(session));
    }
    redirect("/auth/after");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-base p-6">
      <ClerkThemedSignIn
        path="/login"
        routing="path"
        signUpUrl="/register"
        forceRedirectUrl="/auth/after"
        fallbackRedirectUrl="/auth/after"
      />
    </div>
  );
}
