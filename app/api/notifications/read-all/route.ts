import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function PATCH() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: sessionUser.clerkId },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_MS);

  const result = await prisma.notification.updateMany({
    where: { userId: dbUser.id, read: false, createdAt: { gte: since } },
    data: { read: true },
  });

  return NextResponse.json({ updated: result.count });
}
