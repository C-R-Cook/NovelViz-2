import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@db";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const ALL_STATUSES: BookStatus[] = [
  "draft",
  "pending_review",
  "rejected",
  "published",
  "unlisted",
  "processing",
  "ready_for_review",
];

function isBookStatus(v: unknown): v is BookStatus {
  return typeof v === "string" && (ALL_STATUSES as string[]).includes(v);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, ownerId: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && book.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    !isBookStatus((body as { status: unknown }).status)
  ) {
    return NextResponse.json({ error: "Expected { status: BookStatus }" }, { status: 400 });
  }

  const status = (body as { status: BookStatus }).status;

  const updated = await prisma.book.update({
    where: { id: bookId },
    data: { status },
  });
  return NextResponse.json({ book: updated });
}
