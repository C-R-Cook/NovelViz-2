import { createClerkClient } from "@clerk/backend";

import { recalculateImageLikeCounts } from "@/lib/gallery-like-counts";
import { prisma } from "@/lib/prisma";
import {
  ensureNovelVizTombstoneUser,
  isNovelVizTombstoneUser,
  NOVELVIZ_TOMBSTONE_USER_ID,
} from "@/lib/system-users";
import type { UserRole } from "@db";

const DEV_CLERK_PREFIX = "user_dev_clerk_";

export class DeleteUserError extends Error {
  readonly code: "not_found" | "forbidden" | "last_admin" | "system_user";

  constructor(message: string, code: "not_found" | "forbidden" | "last_admin" | "system_user") {
    super(message);
    this.name = "DeleteUserError";
    this.code = code;
  }
}

function isClerkUserNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = "status" in err ? (err as { status?: number }).status : undefined;
  if (status === 404) return true;
  const errors =
    "errors" in err ? (err as { errors?: Array<{ code?: string }> }).errors : undefined;
  return (
    errors?.some(
      (e) => e.code === "resource_not_found" || e.code === "form_identifier_not_found",
    ) ?? false
  );
}

/** Removes the Clerk account so active sessions cannot recreate a DB row via `ensureDbUserForClerk`. */
async function deleteClerkAccount(clerkId: string): Promise<void> {
  if (clerkId.startsWith(DEV_CLERK_PREFIX)) return;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;

  const clerk = createClerkClient({ secretKey });
  try {
    await clerk.users.deleteUser(clerkId);
  } catch (err) {
    if (isClerkUserNotFound(err)) return;
    throw err;
  }
}

function snapshotFormerUsername(username: string | null | undefined): string | null {
  const trimmed = username?.trim();
  return trimmed ? trimmed : null;
}

async function deleteUserData(userId: string): Promise<void> {
  if (isNovelVizTombstoneUser(userId)) {
    throw new DeleteUserError("System accounts cannot be deleted", "system_user");
  }

  await ensureNovelVizTombstoneUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!user) {
    throw new DeleteUserError("User not found", "not_found");
  }

  const formerUsername = snapshotFormerUsername(user.username);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const ownedImages = await tx.generatedImage.findMany({
      where: { userId },
      select: { id: true },
    });
    const ownedImageIds = ownedImages.map((img) => img.id);

    if (ownedImageIds.length > 0) {
      await tx.generatedImage.updateMany({
        where: { userId },
        data: {
          userId: NOVELVIZ_TOMBSTONE_USER_ID,
          deidentifiedAt: now,
          formerUsername,
        },
      });
    }

    await tx.comment.deleteMany({ where: { userId } });

    const likedImages = await tx.like.findMany({
      where: { userId },
      select: { imageId: true },
    });
    const likedImageIds = likedImages.map((like) => like.imageId);

    await tx.query.deleteMany({ where: { userId } });
    await tx.readingProgress.deleteMany({ where: { userId } });
    await tx.userBook.deleteMany({ where: { userId } });
    await tx.bookRequest.deleteMany({ where: { userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.featureRequest.deleteMany({ where: { requestedBy: userId } });
    await tx.partnerApplication.deleteMany({ where: { userId } });
    await tx.coverAiQuotaRequest.deleteMany({ where: { requesterId: userId } });
    await tx.creditTransaction.deleteMany({ where: { userId } });
    await tx.userQuotaOverride.deleteMany({ where: { userId } });
    await tx.aiServiceFailure.deleteMany({ where: { userId } });
    await tx.userGrant.deleteMany({ where: { userId } });
    await tx.userBadge.deleteMany({ where: { userId } });
    await tx.partnerRequest.updateMany({ where: { userId }, data: { userId: null } });
    await tx.featureRequest.updateMany({ where: { reviewedBy: userId }, data: { reviewedBy: null } });
    await tx.book.updateMany({ where: { ownerId: userId }, data: { ownerId: null } });

    await recalculateImageLikeCounts(likedImageIds, tx);

    await tx.user.delete({ where: { id: userId } });
  });
}

async function assertNotLastAdmin(userId: string, role: UserRole): Promise<void> {
  if (role !== "admin") return;
  const adminCount = await prisma.user.count({
    where: { role: "admin", isSystemUser: false },
  });
  if (adminCount <= 1) {
    throw new DeleteUserError("Cannot delete the last admin account", "last_admin");
  }
}

/**
 * Permanently deletes a user from Clerk (when applicable) and removes all related DB rows.
 * Gallery images are reassigned to the NovelViz tombstone user; the user's comments are removed.
 * Clerk is deleted first to prevent `ensureDbUserForClerk` from recreating a ghost user row.
 */
export async function deleteUserCompletely(
  userId: string,
  options?: { preventLastAdmin?: boolean },
): Promise<void> {
  if (isNovelVizTombstoneUser(userId)) {
    throw new DeleteUserError("System accounts cannot be deleted", "system_user");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkId: true, role: true, isSystemUser: true },
  });
  if (!user) {
    throw new DeleteUserError("User not found", "not_found");
  }
  if (user.isSystemUser) {
    throw new DeleteUserError("System accounts cannot be deleted", "system_user");
  }

  if (options?.preventLastAdmin) {
    await assertNotLastAdmin(userId, user.role);
  }

  await deleteClerkAccount(user.clerkId);
  await deleteUserData(userId);
}

/** DB cleanup when Clerk has already removed the user (e.g. `user.deleted` webhook). */
export async function deleteUserDataByClerkId(clerkId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, isSystemUser: true },
  });
  if (!user || user.isSystemUser) return;
  await deleteUserData(user.id);
}
