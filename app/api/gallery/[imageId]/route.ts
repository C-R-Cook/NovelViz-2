import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageId } = await context.params;

  let body: { isPublic?: unknown };
  try {
    body = (await request.json()) as { isPublic?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.isPublic !== "boolean") {
    return NextResponse.json({ error: "isPublic must be a boolean" }, { status: 400 });
  }

  const existing = await prisma.generatedImage.findUnique({
    where: { id: imageId },
    select: { id: true, userId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  if (existing.userId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.generatedImage.update({
    where: { id: imageId },
    data: { isPublic: body.isPublic },
    select: {
      id: true,
      isPublic: true,
      likeCount: true,
    },
  });

  return NextResponse.json({ image: updated });
}
