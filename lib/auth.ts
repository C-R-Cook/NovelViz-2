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

const DEV_USERS: Record<string, CurrentUser> = {
  reader: {
    id: "dev_user_reader",
    clerkId: "user_dev_clerk_reader",
    email: "dev_reader@novelviz.local",
    name: "Dev Reader",
    role: UserRole.reader,
  },
  partner: {
    id: "dev_user_partner",
    clerkId: "user_dev_clerk_partner",
    email: "dev_partner@novelviz.local",
    name: "Dev Partner",
    role: UserRole.partner,
  },
  admin: {
    id: "dev_user_admin",
    clerkId: "user_dev_clerk_admin",
    email: "dev_admin@novelviz.local",
    name: "Dev Admin",
    role: UserRole.admin,
  },
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const store = await cookies();
    const cookieValue = store.get("dev_role")?.value;
    return DEV_USERS[cookieValue ?? ""] ?? DEV_USERS.admin;
  }

  // TODO: const { userId } = await auth(); … fetch User by clerkId
  return null;
}

export function getRoleHomeUrl(role: UserRole): string {
  if (role === UserRole.partner) return "/partner/dashboard";
  if (role === UserRole.admin) return "/admin/books";
  return "/library";
}
