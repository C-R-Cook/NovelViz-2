import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import {
  DEV_USER_COOKIE,
  DEV_USERS_BY_ID,
  hasDevIdentityCookie,
  type DevIdentityUser,
  type DevUserRole,
  resolveDevUserIdFromCookies,
} from "@/lib/dev-users";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@db";

/**
 * Server session identity for components and route handlers.
 *
 * - **Production:** Clerk `auth()` → `User` row by `clerkId` (synced via Clerk webhook).
 * - **Development:** `dev_user_id` / legacy `dev_role` cookie when set (role switcher);
 *   otherwise same Clerk path so real sign-in works locally.
 */
export type CurrentUser = DevIdentityUser;

const userSelect = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  role: true,
  username: true,
  subscribedToMailingList: true,
} as const;

type DbUserForSession = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  role: UserRole;
  username: string | null;
  subscribedToMailingList: boolean;
};

function mapDbUserToCurrentUser(dbUser: DbUserForSession): CurrentUser {
  const role: DevUserRole =
    dbUser.role === "admin" || dbUser.role === "partner" || dbUser.role === "reader"
      ? dbUser.role
      : "reader";
  return {
    id: dbUser.id,
    clerkId: dbUser.clerkId,
    email: dbUser.email,
    name: dbUser.name,
    role,
    username: dbUser.username,
    subscribedToMailingList: dbUser.subscribedToMailingList,
  };
}

async function getClerkUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: userSelect,
  });
  if (!dbUser) return null;

  return mapDbUserToCurrentUser(dbUser);
}

async function getDevUserFromCookies(): Promise<CurrentUser | null> {
  const store = await cookies();
  const devUserId = store.get(DEV_USER_COOKIE)?.value;
  const legacyRole = store.get("dev_role")?.value;

  if (!hasDevIdentityCookie(devUserId, legacyRole)) {
    return null;
  }

  const id = resolveDevUserIdFromCookies(devUserId, legacyRole);
  const base = DEV_USERS_BY_ID[id];
  if (!base) return null;

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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const devUser = await getDevUserFromCookies();
    if (devUser) return devUser;
    return getClerkUser();
  }

  return getClerkUser();
}

export function getRoleHomeUrl(): string {
  return "/library";
}
