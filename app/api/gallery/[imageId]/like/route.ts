import { getCurrentUser } from "@/lib/auth";
import {
  isGeneratedImageChapterLockedForViewer,
  parseLikeRequestSessionUnlockIds,
} from "@/lib/gallery-image-lock-server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageId } = await context.params;
  const bodyUnknown = await request.json().catch(() => ({}));
  const sessionBrowsingUnlockedBookIds = parseLikeRequestSessionUnlockIds(bodyUnknown);

  const existing = await prisma.generatedImage.findUnique({
    where: { id: imageId },
    select: { id: true, userId: true, bookId: true, chapterNumberAtTime: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  if (existing.userId === user.id) {
    return NextResponse.json(
      { error: "You cannot like your own image", code: "OWN_IMAGE" as const },
      { status: 400 },
    );
  }

  const isAdmin = user.role === "admin";
  const locked = await isGeneratedImageChapterLockedForViewer({
    userId: user.id,
    isAdmin,
    bookId: existing.bookId,
    chapterNumberAtTime: existing.chapterNumberAtTime,
    sessionBrowsingUnlockedBookIds,
  });
  if (locked) {
    return NextResponse.json(
      {
        error: "Unlock this image (or this book's gallery) before liking",
        code: "IMAGE_LOCKED" as const,
      },
      { status: 403 },
    );
  }

  const [, likeCount] = await prisma.$transaction([
    prisma.like.upsert({
      where: { userId_imageId: { userId: user.id, imageId } },
      update: {},
      create: { userId: user.id, imageId },
    }),
    prisma.like.count({
      where: { imageId },
    }),
  ]);

  await prisma.generatedImage.update({
    where: { id: imageId },
    data: { likeCount },
  });

  return NextResponse.json({ likeCount });
}
