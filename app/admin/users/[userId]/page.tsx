import { UserDetailClient } from "./user-detail-client";
import { prisma } from "@/lib/prisma";
import { isBetaModeEnabled } from "@/lib/subscription";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ userId: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const { userId } = await params;
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!exists) notFound();

  const betaMode = isBetaModeEnabled();

  return <UserDetailClient userId={userId} betaMode={betaMode} />;
}
