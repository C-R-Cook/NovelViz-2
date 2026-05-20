import { OnboardingClient } from "./onboarding-client";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Welcome | NovelViz",
};

export default async function OnboardingPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
    select: { id: true, username: true },
  });
  if (!user) {
    redirect("/sign-in");
  }
  if (user.username?.trim()) {
    redirect(getRoleHomeUrl());
  }

  return <OnboardingClient />;
}
