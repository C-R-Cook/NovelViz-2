import { ensureCurrentUser } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { DEV_USER_COOKIE, hasDevIdentityCookie } from "@/lib/dev-users";
import { redirect } from "next/navigation";

export default async function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // In dev mode, skip the Clerk auth guard when a valid dev identity cookie is
  // present. This lets the role switcher work while signed out of Clerk locally.
  // In production, always require a Clerk session (no dev cookies exist there).
  if (process.env.NODE_ENV !== "production") {
    const store = await cookies();
    const devUserId = store.get(DEV_USER_COOKIE)?.value;
    const legacyRole = store.get("dev_role")?.value;
    if (!hasDevIdentityCookie(devUserId, legacyRole)) {
      const { userId } = await auth();
      if (!userId) redirect("/sign-in");
    }
  } else {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
  }

  const user = await ensureCurrentUser();
  if (!user) {
    redirect("/auth/after");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      {children}
    </div>
  );
}
