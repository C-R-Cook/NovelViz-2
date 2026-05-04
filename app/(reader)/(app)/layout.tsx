import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/** Reader routes that require a completed profile (username). Onboarding lives outside this group. */
export default async function ReaderAppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
    select: { username: true },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }
  if (!dbUser.username?.trim()) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
