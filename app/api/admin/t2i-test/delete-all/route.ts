import { getCurrentUser } from "@/lib/auth";
import { T2I_TESTER_MODEL_LABELS } from "@/lib/t2i-tester-config";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const imageWhere = {
    userId: dbUser.id,
    model: { in: [...T2I_TESTER_MODEL_LABELS] },
  };

  await prisma.featureRequest.deleteMany({
    where: { image: imageWhere },
  });

  await prisma.like.deleteMany({
    where: { image: imageWhere },
  });

  const deleted = await prisma.generatedImage.deleteMany({
    where: imageWhere,
  });

  return NextResponse.json({ deleted: deleted.count });
}
