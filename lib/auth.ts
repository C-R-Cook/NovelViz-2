/**
 * Current user for server components and route handlers.
 *
 * TODO (production): Replace dev branch with Clerk `auth()` + load or create `User` from DB:
 *   const { userId } = await auth();
 *   if (!userId) return null;
 *   return prisma.user.findUnique({ where: { clerkId: userId } });
 */
export type CurrentUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
};

const DEV_USER: CurrentUser = {
  id: "dev_user_local",
  clerkId: "user_dev_clerk_local",
  email: "dev@novelviz.local",
  name: "Dev Reader",
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    return DEV_USER;
  }

  // TODO: const { userId } = await auth(); … fetch User by clerkId
  return null;
}
