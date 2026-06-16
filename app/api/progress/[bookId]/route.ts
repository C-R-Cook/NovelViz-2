import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ bookId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await context.params;

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = await prisma.readingProgress.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
  });

  return NextResponse.json({ progress });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await context.params;

  let body: { chapterId?: string; chapterNumber?: number };
  try {
    body = (await request.json()) as { chapterId?: string; chapterNumber?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chapterId, chapterNumber } = body;
  if (!chapterId || typeof chapterId !== "string") {
    return NextResponse.json({ error: "chapterId is required" }, { status: 400 });
  }
  if (chapterNumber == null || typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber)) {
    return NextResponse.json({ error: "chapterNumber is required" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
  });
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found for this book" }, { status: 404 });
  }
  if (chapter.sequenceNumber !== chapterNumber) {
    return NextResponse.json(
      { error: "chapterNumber does not match chapter" },
      { status: 400 },
    );
  }

  const progress = await prisma.readingProgress.upsert({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
    create: {
      userId: dbUser.id,
      bookId,
      currentChapterId: chapterId,
      currentChapterNumber: chapterNumber,
    },
    update: {
      currentChapterId: chapterId,
      currentChapterNumber: chapterNumber,
    },
  });

  return NextResponse.json({ progress });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await context.params;

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.readingProgress.deleteMany({
    where: { userId: dbUser.id, bookId },
  });

  return NextResponse.json({ progress: null });
}
