import { getCurrentUser } from "@/lib/auth";
import {
  canAccessBookCoverAi,
  resolveCoverAiQuotaExempt,
} from "@/lib/cover-ai-access";
import { getCoverAiAdminSettings } from "@/lib/cover-ai-settings";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;
  const { searchParams } = new URL(request.url);
  const quotaExemptQuery = searchParams.get("quotaExempt") === "1";

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: {
      id: true,
      title: true,
      author: true,
      ownerId: true,
      status: true,
      isPublicDomain: true,
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

  const settings = await getCoverAiAdminSettings();
  const quotaExempt = resolveCoverAiQuotaExempt({
    role: dbUser.role,
    quotaExemptRequested: quotaExemptQuery,
    book,
  });

  const pending = await prisma.coverAiQuotaRequest.findFirst({
    where: { bookId, handledAt: null },
    select: { id: true },
  });

  const granted = book.coverGenAttemptsGranted ?? 0;
  const consumed = book.coverGenAttemptsConsumed ?? 0;
  const remainingAttempts = Math.max(0, granted - consumed);

  return NextResponse.json({
    bookId: book.id,
    quotaExempt,
    models: settings.modelsJson.map((m) => ({ key: m.key, label: m.label })),
    defaultModelKey: settings.modelsJson[0]?.key ?? "flux-schnell",
    suggestionTitle: book.title,
    suggestionAuthor: book.author,
    coverGenAttemptsConsumed: consumed,
    coverGenAttemptsGranted: granted,
    remainingAttempts,
    hasPendingQuotaRequest: Boolean(pending),
  });
}
