/** Matches Prisma `UserRole` string values — kept string-only so client components can import this file without `@db`/Prisma. */
export type DevUserRole = "reader" | "partner" | "admin";

/** Cookie name for dev identity (value = user `id`, e.g. `dev_user_reader`). */
export const DEV_USER_COOKIE = "dev_user_id";

export type DevIdentityUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  role: DevUserRole;
  username: string | null;
  subscribedToMailingList: boolean;
};

export const DEV_USERS_BY_ID: Record<string, DevIdentityUser> = {
  dev_user_reader: {
    id: "dev_user_reader",
    clerkId: "user_dev_clerk_reader",
    email: "dev_reader@novelviz.local",
    name: "Dev Reader",
    role: "reader",
    username: "dev_reader",
    subscribedToMailingList: false,
  },
  dev_user_reader2: {
    id: "dev_user_reader2",
    clerkId: "user_dev_clerk_reader2",
    email: "dev_reader2@novelviz.local",
    name: "Dev Reader 2",
    role: "reader",
    username: "dev_reader2",
    subscribedToMailingList: false,
  },
  dev_user_reader3: {
    id: "dev_user_reader3",
    clerkId: "user_dev_clerk_reader3",
    email: "dev_reader3@novelviz.local",
    name: "Dev Reader 3",
    role: "reader",
    username: "dev_reader3",
    subscribedToMailingList: false,
  },
  dev_user_partner: {
    id: "dev_user_partner",
    clerkId: "user_dev_clerk_partner",
    email: "dev_partner@novelviz.local",
    name: "Dev Partner",
    role: "partner",
    username: "dev_partner",
    subscribedToMailingList: false,
  },
  dev_user_partner2: {
    id: "dev_user_partner2",
    clerkId: "user_dev_clerk_partner2",
    email: "dev_partner2@novelviz.local",
    name: "Dev Partner 2",
    role: "partner",
    username: "dev_partner2",
    subscribedToMailingList: false,
  },
  dev_user_admin: {
    id: "dev_user_admin",
    clerkId: "user_dev_clerk_admin",
    email: "dev_admin@novelviz.local",
    name: "Dev Admin",
    role: "admin",
    username: "dev_admin",
    subscribedToMailingList: false,
  },
};

/** Legacy `dev_role` cookie values → default dev user id (migration). */
const LEGACY_DEV_ROLE_TO_USER_ID: Record<string, string> = {
  reader: "dev_user_reader",
  partner: "dev_user_partner",
  admin: "dev_user_admin",
};

export function hasDevIdentityCookie(
  devUserId: string | undefined,
  legacyDevRole: string | undefined,
): boolean {
  if (devUserId && DEV_USERS_BY_ID[devUserId]) return true;
  if (legacyDevRole && LEGACY_DEV_ROLE_TO_USER_ID[legacyDevRole]) return true;
  return false;
}

export function resolveDevUserIdFromCookies(
  devUserId: string | undefined,
  legacyDevRole: string | undefined,
): string {
  if (devUserId && DEV_USERS_BY_ID[devUserId]) return devUserId;
  if (legacyDevRole && LEGACY_DEV_ROLE_TO_USER_ID[legacyDevRole]) {
    return LEGACY_DEV_ROLE_TO_USER_ID[legacyDevRole]!;
  }
  return "dev_user_admin";
}
