import { AuthTemporarilyDisabled } from "@/components/auth/auth-temporarily-disabled";
import { CustomEmailSignUp } from "@/components/auth/custom-email-sign-up";
import { ensureCurrentUser } from "@/lib/auth";
import { AUTH_SIGNUP_LOGIN_DISABLED } from "@/lib/auth-ui-gates";
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

  if (AUTH_SIGNUP_LOGIN_DISABLED) {
    return (
      <div className="register-page bg-bg-base">
        <AuthTemporarilyDisabled />
      </div>
    );
  }

  return (
    <div className="register-page bg-bg-base">
      <CustomEmailSignUp />
    </div>
  );
}
