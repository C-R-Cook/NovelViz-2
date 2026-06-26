import { CustomEmailSignUp } from "@/components/auth/custom-email-sign-up";
import { ensureCurrentUser } from "@/lib/auth";
import { resolvePostAuthRedirect } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
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
      <CustomEmailSignUp />
    </div>
  );
}
