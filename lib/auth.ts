import { UserRole } from "@db";
import { cookies } from "next/headers";

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
  role: UserRole;
};

const DEV_USER: CurrentUser = {
  id: "dev_user_local",
  clerkId: "user_dev_clerk_local",
  email: "dev@novelviz.local",
  name: "Dev Reader",
  role: UserRole.admin,
};

function devRoleFromCookieValue(raw: string | undefined): UserRole | null {
  if (raw === UserRole.reader || raw === UserRole.partner || raw === UserRole.admin) {
    return raw;
  }
  return null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const store = await cookies();
    const raw = store.get("dev_role")?.value;
    const role = devRoleFromCookieValue(raw) ?? DEV_USER.role;
    return { ...DEV_USER, role };
  }

  // TODO: const { userId } = await auth(); … fetch User by clerkId
  return null;
}

export function getRoleHomeUrl(role: UserRole): string {
  if (role === UserRole.partner) return "/partner/dashboard";
  if (role === UserRole.admin) return "/admin/books";
  return "/library";
}
