import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ bookId: string }> };

export async function POST(_request: Request, context: RouteContext) {
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

  const existing = await prisma.userBook.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
  });

  if (existing) {
    await prisma.userBook.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  } else {
    await prisma.userBook.create({
      data: {
        userId: dbUser.id,
        bookId,
        isActive: true,
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
