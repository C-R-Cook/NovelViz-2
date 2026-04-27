import { cookies } from "next/headers";
import {
  DEV_USER_COOKIE,
  DEV_USERS_BY_ID,
  type DevIdentityUser,
  resolveDevUserIdFromCookies,
} from "@/lib/dev-users";

/**
 * Current user for server components and route handlers.
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
    return DEV_USERS_BY_ID[id] ?? DEV_USERS_BY_ID.dev_user_admin;
  }

  // TODO: const { userId } = await auth(); … fetch User by clerkId
  return null;
}

export function getRoleHomeUrl(role: CurrentUser["role"]): string {
  if (role === "partner") return "/partner/dashboard";
  if (role === "admin") return "/admin/books";
  return "/library";
}
