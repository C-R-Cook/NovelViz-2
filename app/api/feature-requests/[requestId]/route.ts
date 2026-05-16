import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { FeatureRequestStatus, NotificationType, UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true, role: true },
  });
  if (!dbUser || dbUser.role !== UserRole.admin) {
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
    include: {
      image: {
        select: {
          id: true,
          bookId: true,
          book: { select: { title: true } },
        },
      },
    },
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
        reviewedBy: dbUser.id,
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

  const bookTitle = reqRow.image.book.title;
  const link = `/gallery/${reqRow.image.bookId}?image=${encodeURIComponent(reqRow.image.id)}`;
  if (action === "approve") {
    await createNotification(
      reqRow.requestedBy,
      NotificationType.FEATURE_REQUEST_APPROVED,
      `Your feature request for "${bookTitle}" was approved.`,
      link,
    );
  } else {
    await createNotification(
      reqRow.requestedBy,
      NotificationType.FEATURE_REQUEST_REJECTED,
      `Your feature request for "${bookTitle}" was not approved.`,
      link,
    );
  }

  return NextResponse.json(updated);
}
