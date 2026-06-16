import { getCurrentUser } from "@/lib/auth";
import {
  AdminEmailCategory,
  absoluteAppUrl,
  sendAdminEmail,
} from "@/lib/admin-email";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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
  const bookTitle = typeof b.bookTitle === "string" ? b.bookTitle.trim() : "";
  const authorName = typeof b.authorName === "string" ? b.authorName.trim() : "";
  const message =
    typeof b.message === "string" && b.message.trim().length > 0 ? b.message.trim() : null;

  if (!bookTitle || !authorName) {
    return NextResponse.json({ error: "bookTitle and authorName are required" }, { status: 400 });
  }

  const session = await getCurrentUser();
  const userId = session?.id ?? null;

  await prisma.bookRequest.create({
    data: {
      userId,
      bookTitle,
      authorName,
      message,
    },
  });

  const requesterLabel =
    session != null
      ? `${session.name?.trim() || session.username || session.id} (${session.email})`
      : "Guest";

  sendAdminEmail({
    category: AdminEmailCategory.BOOK_REQUEST,
    subjectDetail: `${bookTitle} - ${authorName}`,
    bodyLines: [
      { label: "Book title", value: bookTitle },
      { label: "Author", value: authorName },
      ...(message ? [{ label: "Message", value: message }] : []),
      { label: "Requester", value: requesterLabel },
      { label: "Admin queue", value: absoluteAppUrl("/admin/requests") },
    ],
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.bookRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const countByTitle = new Map<string, number>();
  for (const r of requests) {
    const key = r.bookTitle;
    countByTitle.set(key, (countByTitle.get(key) ?? 0) + 1);
  }

  const countsByBookTitle = Object.fromEntries(countByTitle);

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      bookTitle: r.bookTitle,
      authorName: r.authorName,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      user: r.user ? { name: r.user.name, email: r.user.email } : null,
    })),
    countsByBookTitle,
  });
}
