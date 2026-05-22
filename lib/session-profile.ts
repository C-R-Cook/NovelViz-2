import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionProfileRow = {
  id: string;
  username: string | null;
};

/** DB profile for a session user (Clerk or dev identity). */
export async function findDbProfileForSession(
  session: CurrentUser,
): Promise<SessionProfileRow | null> {
  const byClerk = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
    select: { id: true, username: true },
  });
  if (byClerk) return byClerk;

  return prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true },
  });
}

export function profileNeedsOnboarding(profile: SessionProfileRow | null): boolean {
  return !profile?.username?.trim();
}

/** Where to send someone after Clerk sign-in / sign-up. */
export function getPostAuthRedirectUrl(profile: SessionProfileRow | null): string {
  return profileNeedsOnboarding(profile) ? "/onboarding" : "/library";
}
