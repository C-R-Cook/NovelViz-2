import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@db";

export type ApiSessionDbUser = {
  id: string;
  role: UserRole;
  globalSpoilerProtection: boolean;
};

/**
 * Resolves the Prisma `User` for API routes from `getCurrentUser()` (Clerk in production,
 * dev cookie or Clerk in development). Tries `clerkId` first, then `id` for dev identities.
 */
export async function resolveDbUserFromSession(
  sessionUser: CurrentUser,
): Promise<ApiSessionDbUser | null> {
  const byClerk = await prisma.user.findUnique({
    where: { clerkId: sessionUser.clerkId },
    select: { id: true, role: true, globalSpoilerProtection: true },
  });
  if (byClerk) return byClerk;
  return prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, globalSpoilerProtection: true },
  });
}
