// TODO: deprecated — functionality moved to /dashboard tabs
import "./admin-mobile.css";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Nav } from "@/components/nav";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { enforceAccountAccessForPage } from "@/lib/account-status-routing";
import { loadDashboardNavBadgeCounts } from "@/lib/dashboard-data";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await enforceAccountAccessForPage();

  const user = await getCurrentUser();
  if (!user) {
    redirect("/library");
  }
  if (user.role !== UserRole.admin) {
    redirect(getRoleHomeUrl());
  }

  const [badgeCounts, dbUser] = await Promise.all([
    loadDashboardNavBadgeCounts(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true, name: true, email: true },
    }),
  ]);

  const displayName =
    dbUser?.username?.trim() ||
    dbUser?.name?.trim() ||
    dbUser?.email.split("@")[0] ||
    "Administrator";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      <Nav />
      <div className="flex min-h-0 flex-1 flex-col pt-[calc(3.5rem+0.25rem)]">
        <DashboardShell
          role="admin"
          roleDisplayLabel="Administrator"
          displayName={displayName}
          badgeCounts={badgeCounts}
        >
          {children}
        </DashboardShell>
      </div>
    </div>
  );
}
