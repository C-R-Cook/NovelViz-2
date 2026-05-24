import { DashboardClient } from "./dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import {
  loadAdminDashboardData,
  loadPartnerDashboardData,
  loadReaderDashboardData,
} from "@/lib/dashboard-data";
import { normalizeVendorWindowDays } from "@/lib/admin-stats";
import { parseDashboardTab, type DashboardUserRole } from "@/lib/dashboard-tab";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | NovelViz",
};

type DashboardPageProps = {
  searchParams?: Promise<{ tab?: string | string[]; vendorDays?: string | string[] }>;
};

function toDashboardUserRole(r: UserRole): DashboardUserRole {
  if (r === UserRole.reader) return "reader";
  if (r === UserRole.partner) return "partner";
  return "admin";
}

function roleDisplayLabel(r: UserRole): string {
  if (r === UserRole.reader) return "Reader";
  if (r === UserRole.partner) return "Publisher";
  return "Administrator";
}

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const sp = searchParams ? await searchParams : {};
  const rawTab = firstSearchParam(sp.tab);
  const rawVendorDays = firstSearchParam(sp.vendorDays);
  const vendorWindowDays = normalizeVendorWindowDays(rawVendorDays);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      country: true,
      ageRange: true,
      gender: true,
      genrePreferences: true,
      subscribedToMailingList: true,
      globalSpoilerProtection: true,
      createdAt: true,
    },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const userId = dbUser.id;
  const role = dbUser.role;
  const dashboardRole = toDashboardUserRole(role);
  const activeTab = parseDashboardTab(dashboardRole, rawTab);

  const memberSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(dbUser.createdAt);

  const isPartnerOrAdmin = role === UserRole.partner || role === UserRole.admin;
  const isAdmin = role === UserRole.admin;

  const [reader, partner, adminBundle] = await Promise.all([
    loadReaderDashboardData(userId),
    isPartnerOrAdmin ? loadPartnerDashboardData(userId) : Promise.resolve(null),
    isAdmin ? loadAdminDashboardData(activeTab, vendorWindowDays) : Promise.resolve(null),
  ]);

  return (
    <DashboardClient
      role={dashboardRole}
      roleDisplayLabel={roleDisplayLabel(role)}
      reader={{
        displayName:
          dbUser.username?.trim() ||
          dbUser.name?.trim() ||
          dbUser.email.split("@")[0] ||
          "Reader",
        username: dbUser.username,
        email: dbUser.email,
        ...reader,
      }}
      partner={partner}
      admin={adminBundle?.admin ?? null}
      adminBooksAll={adminBundle?.adminBooksAll ?? null}
      adminStats={adminBundle?.adminStats ?? null}
      account={{
        viewerId: session.id,
        user: {
          name: dbUser.name,
          username: dbUser.username,
          email: dbUser.email,
          country: dbUser.country,
          ageRange: dbUser.ageRange,
          gender: dbUser.gender,
          genrePreferences: dbUser.genrePreferences,
          subscribedToMailingList: dbUser.subscribedToMailingList,
          globalSpoilerProtection: dbUser.globalSpoilerProtection,
        },
        stats: reader.stats,
        memberSinceLabel,
        isProduction: process.env.NODE_ENV === "production",
      }}
    />
  );
}
