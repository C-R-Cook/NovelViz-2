import { getCurrentUser } from "@/lib/auth";
import { canAccessBookCoverAi } from "@/lib/cover-ai-access";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      coverGenAttemptsConsumed: true,
      coverGenAttemptsGranted: true,
    },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (!canAccessBookCoverAi(dbUser.role, dbUser.id, book)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const granted = book.coverGenAttemptsGranted ?? 0;
  const consumed = book.coverGenAttemptsConsumed ?? 0;
  if (consumed < granted) {
    return NextResponse.json(
      {
        error:
          "You still have cover generations available. This request is only for when your allowance is exhausted.",
      },
      { status: 400 },
    );
  }

  const existing = await prisma.coverAiQuotaRequest.findFirst({
    where: { bookId, handledAt: null },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyPending: true });
  }

  await prisma.coverAiQuotaRequest.create({
    data: {
      bookId,
      requesterId: dbUser.id,
    },
  });

  return NextResponse.json({ ok: true, alreadyPending: false });
}
