import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 15;

export async function GET() {
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

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: dbUser.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        message: true,
        link: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: dbUser.id, read: false, createdAt: { gte: since } },
    }),
  ]);

  return NextResponse.json({
    notifications: items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    count: unreadCount,
  });
}

export async function DELETE() {
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

  const result = await prisma.notification.deleteMany({
    where: { userId: dbUser.id },
  });

  return NextResponse.json({ deleted: result.count });
}
