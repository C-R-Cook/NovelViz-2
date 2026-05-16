import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
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

  const { notificationId } = await context.params;

  const row = await prisma.notification.findFirst({
    where: { id: notificationId, userId: dbUser.id },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
    select: { id: true, read: true },
  });

  return NextResponse.json(updated);
}
