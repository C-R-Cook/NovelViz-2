import { getCurrentUser } from "@/lib/auth";
import { findDbProfileForSession, getPostAuthRedirectUrl } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Legacy URL — send signed-in users to the right app entry, everyone else to Clerk sign-in. */
export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    const session = await getCurrentUser();
    if (session) {
      const profile = await findDbProfileForSession(session);
      redirect(getPostAuthRedirectUrl(profile));
    }
    redirect("/auth/after");
  }
  redirect("/login");
}
