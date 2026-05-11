import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeatureRequestStatus } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("action" in body)) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const { action } = body as { action: unknown };
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const reqRow = await prisma.featureRequest.findUnique({
    where: { id: requestId },
  });
  if (!reqRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const nextStatus =
    action === "approve" ? FeatureRequestStatus.APPROVED : FeatureRequestStatus.REJECTED;
  const setFeatured = action === "approve";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.generatedImage.update({
      where: { id: reqRow.imageId },
      data: { isFeatured: setFeatured },
    });
    return tx.featureRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        reviewedBy: user.id,
      },
      select: {
        id: true,
        imageId: true,
        status: true,
        reviewedBy: true,
        updatedAt: true,
      },
    });
  });

  return NextResponse.json(updated);
}
