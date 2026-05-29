import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { cache } from "react";
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

async function ensureDbUserForClerk(clerkUserId: string): Promise<DbUserForSession | null> {
  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: userSelect,
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkUserId) return null;

  const primary =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ??
    clerkUser.emailAddresses[0];
  const email = primary?.emailAddress ?? "";
  const nameFromParts = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
  const name = nameFromParts || clerkUser.username || null;
  const signupDay = new Date().getDate();
  const anchorDay = Math.min(signupDay, 28);

  return prisma.user.upsert({
    where: { clerkId: clerkUserId },
    create: {
      clerkId: clerkUserId,
      email,
      name,
      usagePeriodAnchor: anchorDay,
    },
    update: { email, name },
    select: userSelect,
  });
}

async function getClerkUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const dbUser = await ensureDbUserForClerk(userId);
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

async function getCurrentUserUncached(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const clerkUser = await getClerkUser();
    if (clerkUser) return clerkUser;
    return getDevUserFromCookies();
  }

  return getClerkUser();
}

/**
 * Resolve (or create) the DB user for the signed-in Clerk account.
 * Retries when `currentUser()` is not ready immediately after sign-up.
 */
export async function ensureCurrentUser(maxAttempts = 8): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV !== "production") {
    const dev = await getDevUserFromCookies();
    if (dev) return dev;
  }

  const { userId } = await auth();
  if (!userId) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const dbUser = await ensureDbUserForClerk(userId);
    if (dbUser) return mapDbUserToCurrentUser(dbUser);
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return null;
}

/** Deduped per request — safe to call from layout and page in the same render. */
export const getCurrentUser = cache(getCurrentUserUncached);

export function getRoleHomeUrl(): string {
  return "/library";
}
