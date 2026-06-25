import { AccountPageClient } from "./account-client";
import { AccountUsageSection } from "@/components/subscription/account-usage-section";
import { getCurrentUser } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { getUserUsageSummary } from "@/lib/subscription";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      username: true,
      email: true,
      country: true,
      ageRange: true,
      gender: true,
      genrePreferences: true,
      subscribedToMailingList: true,
      globalSpoilerProtection: true,
      createdAt: true,
      accountStatus: true,
    },
  });

  if (!user) {
    redirect("/sign-in");
  }

  const memberSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  const [libraryBookCount, queryCount, generatedImageCount, usageSummary, creditBalance] =
    await Promise.all([
    prisma.userBook.count({ where: { userId: session.id, isActive: true } }),
    prisma.query.count({ where: { userId: session.id } }),
    prisma.generatedImage.count({ where: { userId: session.id } }),
    getUserUsageSummary(session.id),
    getCreditBalance(session.id),
  ]);

  return (
    <>
      <AccountPageClient
        viewerId={session.id}
        user={user}
        accountStatus={user.accountStatus}
        creditBalance={creditBalance}
        stats={{ libraryBookCount, queryCount, generatedImageCount }}
        memberSinceLabel={memberSinceLabel}
        isProduction={process.env.NODE_ENV === "production"}
      />
      {usageSummary ? (
        <div className="mx-auto mt-8 w-full max-w-3xl px-4 pb-12 sm:px-6">
          <AccountUsageSection initialUsage={usageSummary} />
        </div>
      ) : null}
    </>
  );
}
