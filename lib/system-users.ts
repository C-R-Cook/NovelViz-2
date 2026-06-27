import { prisma } from "@/lib/prisma";

export const NOVELVIZ_TOMBSTONE_USER_ID = "system_novelviz";
export const NOVELVIZ_TOMBSTONE_CLERK_ID = "user_system_novelviz";

const TOMBSTONE_EMAIL = "deleted-content@novelviz.internal";
const TOMBSTONE_USERNAME = "NovelViz";
const TOMBSTONE_NAME = "NovelViz";

/** Upsert the non-login user that owns de-identified gallery content after account deletion. */
export async function ensureNovelVizTombstoneUser(): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { id: NOVELVIZ_TOMBSTONE_USER_ID },
    create: {
      id: NOVELVIZ_TOMBSTONE_USER_ID,
      clerkId: NOVELVIZ_TOMBSTONE_CLERK_ID,
      email: TOMBSTONE_EMAIL,
      name: TOMBSTONE_NAME,
      username: TOMBSTONE_USERNAME,
      isSystemUser: true,
    },
    update: {
      email: TOMBSTONE_EMAIL,
      name: TOMBSTONE_NAME,
      username: TOMBSTONE_USERNAME,
      isSystemUser: true,
    },
    select: { id: true },
  });
}

export function isNovelVizTombstoneUser(userId: string): boolean {
  return userId === NOVELVIZ_TOMBSTONE_USER_ID;
}
