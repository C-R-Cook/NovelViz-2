import { cookies } from "next/headers";
import {
  DEV_USER_COOKIE,
  DEV_USERS_BY_ID,
  type DevIdentityUser,
  resolveDevUserIdFromCookies,
} from "@/lib/dev-users";
import { prisma } from "@/lib/prisma";

/**
 * Current user for server components and route handlers.
 * Includes `username` and `subscribedToMailingList` from the database when available (dev merges cookie identity with `User`).
 *
 * TODO (production): Replace dev branch with Clerk `auth()` + load or create `User` from DB:
 *   const { userId } = await auth();
 *   if (!userId) return null;
 *   return prisma.user.findUnique({ where: { clerkId: userId } });
 */
export type CurrentUser = DevIdentityUser;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const store = await cookies();
    const id = resolveDevUserIdFromCookies(
      store.get(DEV_USER_COOKIE)?.value,
      store.get("dev_role")?.value,
    );
    const base = DEV_USERS_BY_ID[id] ?? DEV_USERS_BY_ID.dev_user_admin;
    const dbUser = await prisma.user.findUnique({
      where: { id: base.id },
      select: { username: true, subscribedToMailingList: true },
    });
    if (!dbUser) {
      return {
        ...base,
        username: base.username,
        subscribedToMailingList: base.subscribedToMailingList,
      };
    }
    return {
      ...base,
      username: dbUser.username,
      subscribedToMailingList: dbUser.subscribedToMailingList,
    };
  }

  // TODO: const { userId } = await auth(); … fetch User by clerkId
  return null;
}

export function getRoleHomeUrl(): string {
  return "/library";
}
