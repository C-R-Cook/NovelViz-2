import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageId } = await context.params;

  const existing = await prisma.generatedImage.findUnique({
    where: { id: imageId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const updated = await prisma.generatedImage.update({
    where: { id: imageId },
    data: {
      likeCount: { increment: 1 },
    },
    select: {
      likeCount: true,
    },
  });

  return NextResponse.json({ likeCount: updated.likeCount });
}
