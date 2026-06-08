import { OnboardingPreviewClient } from "./onboarding-preview-client";
import { getPublicTierPlans } from "@/lib/tier-limit-config";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Onboarding preview (dev) | NovelViz",
  robots: { index: false, follow: false },
};

export default async function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [initialPlans, creditPackRow] = await Promise.all([
    getPublicTierPlans(),
    prisma.creditPack.findFirst({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        priceFree: true,
        priceStandard: true,
        pricePremium: true,
      },
    }),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-muted">Loading preview…</div>}>
      <OnboardingPreviewClient initialPlans={initialPlans} creditPack={creditPackRow} />
    </Suspense>
  );
}
