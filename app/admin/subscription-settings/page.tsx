import { getAllTierLimitConfigs } from "@/lib/tier-limit-config";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { redirect } from "next/navigation";
import { SubscriptionSettingsClient } from "./subscription-settings-client";

export default async function SubscriptionSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  const [tiers, packs, recentFailures] = await Promise.all([
    getAllTierLimitConfigs(),
    prisma.creditPack.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.aiServiceFailure.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin</p>
        <h1 className="text-2xl font-semibold text-text-primary">Subscription & credits</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Edit per-tier monthly limits, credit costs, and credit pack pricing. Limit increases apply to all
          users immediately. Limit decreases apply only to new sign-ups — existing subscribers keep the limits
          they had when they joined or last changed tier.
        </p>
      </header>

      <SubscriptionSettingsClient
        initialTiers={tiers}
        initialPacks={packs}
        recentFailures={recentFailures.map((f) => ({
          id: f.id,
          route: f.route,
          errorSummary: f.errorSummary,
          userEmail: f.user.email,
          createdAt: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
