import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ bookId: string }> };

const SPOILER: SpoilerProtection[] = ["INHERIT", "PROTECTED", "UNLOCKED"];

export async function POST(request: Request, context: RouteContext) {
  const { bookId } = await context.params;
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, status: "published", deletedAt: null },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  let spoilerUpdate: SpoilerProtection | undefined;
  const body = (await request.json().catch(() => null)) as { spoilerProtection?: unknown } | null;
  const raw = body?.spoilerProtection;
  if (raw !== undefined && raw !== null) {
    if (!SPOILER.includes(raw as SpoilerProtection)) {
      return NextResponse.json(
        { error: "Invalid spoilerProtection — use INHERIT | PROTECTED | UNLOCKED" },
        { status: 400 },
      );
    }
    spoilerUpdate = raw as SpoilerProtection;
  }

  const existing = await prisma.userBook.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
  });

  if (existing) {
    await prisma.userBook.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        ...(spoilerUpdate !== undefined ? { spoilerProtection: spoilerUpdate } : {}),
      },
    });
  } else {
    await prisma.userBook.create({
      data: {
        userId: dbUser.id,
        bookId,
        isActive: true,
        ...(spoilerUpdate !== undefined ? { spoilerProtection: spoilerUpdate } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { bookId } = await context.params;
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.userBook.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
  });

  if (existing) {
    await prisma.userBook.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ ok: true });
}
