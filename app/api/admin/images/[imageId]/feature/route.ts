import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeatureRequestStatus } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { imageId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("isFeatured" in body)) {
    return NextResponse.json({ error: "isFeatured must be a boolean" }, { status: 400 });
  }

  const { isFeatured } = body as { isFeatured: unknown };
  if (typeof isFeatured !== "boolean") {
    return NextResponse.json({ error: "isFeatured must be a boolean" }, { status: 400 });
  }

  const existing = await prisma.generatedImage.findUnique({
    where: { id: imageId },
    select: { id: true, isPublic: true, featureRequest: { select: { id: true, status: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (isFeatured && !existing.isPublic) {
    return NextResponse.json(
      { error: "Only public images can be featured" },
      { status: 400 },
    );
  }

  const image = await prisma.$transaction(async (tx) => {
    const updated = await tx.generatedImage.update({
      where: { id: imageId },
      data: { isFeatured },
    });

    if (isFeatured && existing.featureRequest?.status === FeatureRequestStatus.PENDING) {
      await tx.featureRequest.update({
        where: { id: existing.featureRequest.id },
        data: {
          status: FeatureRequestStatus.APPROVED,
          reviewedBy: user.id,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ id: image.id, isFeatured: image.isFeatured });
}
