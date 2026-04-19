import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const ALL_STATUSES: BookStatus[] = [
  "draft",
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

  try {
    const book = await prisma.book.update({
      where: { id: bookId },
      data: { status },
    });
    return NextResponse.json({ book });
  } catch {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
}
