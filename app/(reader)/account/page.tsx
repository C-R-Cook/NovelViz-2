import { AccountPageClient } from "./account-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
      email: true,
      country: true,
      ageRange: true,
      genrePreferences: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/sign-in");
  }

  const memberSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  const [libraryBookCount, queryCount, generatedImageCount] = await Promise.all([
    prisma.userBook.count({ where: { userId: session.id, isActive: true } }),
    prisma.query.count({ where: { userId: session.id } }),
    prisma.generatedImage.count({ where: { userId: session.id } }),
  ]);

  return (
    <AccountPageClient
      user={user}
      stats={{ libraryBookCount, queryCount, generatedImageCount }}
      memberSinceLabel={memberSinceLabel}
      isProduction={process.env.NODE_ENV === "production"}
    />
  );
}
