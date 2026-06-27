import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNovelVizTombstoneUser } from "@/lib/system-users";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ imageId: string }> };

/** Admin toggle for public visibility on de-identified (tombstone-owned) gallery images. */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { imageId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as { isPublic?: unknown }).isPublic !== "boolean") {
    return NextResponse.json({ error: "isPublic must be a boolean" }, { status: 400 });
  }

  const { isPublic } = body as { isPublic: boolean };

  const existing = await prisma.generatedImage.findUnique({
    where: { id: imageId },
    select: { id: true, userId: true, isFeatured: true, deidentifiedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  if (!isNovelVizTombstoneUser(existing.userId) || !existing.deidentifiedAt) {
    return NextResponse.json(
      { error: "Only de-identified gallery images can be updated here" },
      { status: 403 },
    );
  }

  if (!isPublic && existing.isFeatured) {
    return NextResponse.json(
      { error: "Remove featured status before making this image private" },
      { status: 400 },
    );
  }

  const updated = await prisma.generatedImage.update({
    where: { id: imageId },
    data: { isPublic },
    select: { id: true, isPublic: true },
  });

  return NextResponse.json({ image: updated });
}
