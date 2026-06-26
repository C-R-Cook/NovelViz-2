import { CustomEmailSignIn } from "@/components/auth/custom-email-sign-in";
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
    <div className="register-page bg-bg-base">
      <CustomEmailSignIn />
    </div>
  );
}
