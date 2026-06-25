import { Nav } from "@/components/nav";
import { requireAccountStatusForPage } from "@/lib/account-status-routing";
import { getModerationLogsForUser } from "@/lib/account-enforcement";
import { prisma } from "@/lib/prisma";
import { SuspendedAccountClient } from "./suspended-account-client";

export default async function SuspendedAccountPage() {
  const { userId } = await requireAccountStatusForPage("suspended");

  const [logs, user, pendingAppeal] = await Promise.all([
    getModerationLogsForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { statusReason: true },
    }),
    prisma.moderationAppeal.count({
      where: { userId, status: "pending" },
    }),
  ]);

  return (
    <>
      <Nav />
      <main className="flex-1 pt-14">
        <SuspendedAccountClient
          strikes={logs.map((log) => ({
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            aupCategory: log.aupCategory,
            summary: log.summary,
            source: log.source,
          }))}
          statusReason={user?.statusReason ?? null}
          hasPendingAppeal={pendingAppeal > 0}
        />
      </main>
    </>
  );
}
