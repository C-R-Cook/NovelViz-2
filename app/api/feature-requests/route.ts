import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeatureRequestStatus } from "@db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "partner" && user.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("imageId" in body)) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 });
  }

  const { imageId } = body as { imageId: unknown };
  if (typeof imageId !== "string" || !imageId.trim()) {
    return NextResponse.json({ error: "imageId must be a non-empty string" }, { status: 400 });
  }

  const image = await prisma.generatedImage.findFirst({
    where: { id: imageId.trim() },
    include: { book: { select: { ownerId: true } } },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  if (!image.isPublic) {
    return NextResponse.json({ error: "Only public images can be featured" }, { status: 400 });
  }

  if (user.role === "partner") {
    if (!image.book.ownerId || image.book.ownerId !== user.id) {
      return NextResponse.json({ error: "You can only request features for images on your own books" }, { status: 403 });
    }
  }

  const existing = await prisma.featureRequest.findUnique({
    where: { imageId: image.id },
  });

  if (existing) {
    if (existing.status === FeatureRequestStatus.REJECTED) {
      await prisma.featureRequest.delete({ where: { id: existing.id } });
    } else {
      return NextResponse.json(
        { error: "A pending or approved feature request already exists for this image" },
        { status: 409 },
      );
    }
  }

  const created = await prisma.featureRequest.create({
    data: {
      imageId: image.id,
      requestedBy: user.id,
      status: FeatureRequestStatus.PENDING,
    },
    select: {
      id: true,
      imageId: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
