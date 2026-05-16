import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@db";
import { UserRole } from "@db";

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  link: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, message, link },
    });
  } catch (err) {
    console.error("[notifications] createNotification failed", { userId, type, err });
  }
}

/** Fire-and-forget notifications to every user with the given role (e.g. admins on flag / reinstate). */
export function notifyUsersWithRole(
  role: UserRole,
  type: NotificationType,
  message: string,
  link: string,
): void {
  void (async () => {
    try {
      const users = await prisma.user.findMany({
        where: { role },
        select: { id: true },
      });
      for (const u of users) {
        await createNotification(u.id, type, message, link);
      }
    } catch (err) {
      console.error("[notifications] notifyUsersWithRole failed", { role, type, err });
    }
  })();
}
