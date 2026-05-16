import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { BookStatus, NotificationType, UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const ALL_STATUSES: BookStatus[] = [
  "draft",
  "pending_review",
  "rejected",
  "published",
  "unlisted",
  "processing",
];

function isBookStatus(v: unknown): v is BookStatus {
  return typeof v === "string" && (ALL_STATUSES as string[]).includes(v);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true, role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true, status: true, title: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (dbUser.role !== UserRole.admin && book.ownerId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!("status" in b) || !isBookStatus(b.status)) {
    return NextResponse.json({ error: "Expected { status: BookStatus, rejectionReason?: string | null }" }, { status: 400 });
  }

  const status = b.status;
  let rejectionReasonPayload: string | undefined;

  if ("rejectionReason" in b) {
    const rr = b.rejectionReason;
    if (rr !== null && rr !== undefined && typeof rr !== "string") {
      return NextResponse.json({ error: "rejectionReason must be a string or null" }, { status: 400 });
    }
    rejectionReasonPayload = rr === null || rr === undefined ? undefined : rr.trim();
  }

  const data: {
    status: BookStatus;
    rejectionReason?: string | null;
    listingPreferenceAfterReview?: null;
  } = { status };

  if (book.status === "pending_review" && status !== "pending_review") {
    data.listingPreferenceAfterReview = null;
  }

  if (status === "rejected") {
    const reason = (rejectionReasonPayload ?? "").trim();
    if (!reason || reason.length < 20) {
      return NextResponse.json(
        { error: "rejectionReason is required (at least 20 characters) when status is rejected" },
        { status: 400 },
      );
    }
    data.rejectionReason = reason;
  } else {
    data.rejectionReason = null;
  }

  const previousStatus = book.status;

  const updated = await prisma.book.update({
    where: { id: bookId },
    data,
  });

  if (
    dbUser.role === UserRole.admin &&
    book.ownerId &&
    previousStatus === "pending_review" &&
    (updated.status === "published" || updated.status === "rejected")
  ) {
    const link = `/partner/books/${bookId}`;
    if (updated.status === "published") {
      await createNotification(
        book.ownerId,
        NotificationType.BOOK_APPROVED,
        `Your book "${book.title}" was approved and is now published.`,
        link,
      );
    } else {
      const reason = updated.rejectionReason?.trim();
      const reasonSuffix = reason && reason.length > 0 ? ` Reason: ${reason.slice(0, 200)}` : "";
      await createNotification(
        book.ownerId,
        NotificationType.BOOK_REJECTED,
        `Your book "${book.title}" was not approved.${reasonSuffix}`,
        link,
      );
    }
  }

  return NextResponse.json({
    book: updated,
    status: updated.status,
    rejectionReason: updated.rejectionReason,
  });
}
