import { AI_FAILURE_MESSAGE } from "@/lib/ai-failure-constants";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function reportAiServiceFailure(params: {
  userId: string;
  route: string;
  bookId?: string | null;
  error: unknown;
}): Promise<void> {
  const summary =
    params.error instanceof Error
      ? params.error.message.slice(0, 2000)
      : String(params.error).slice(0, 2000);
  try {
    await prisma.aiServiceFailure.create({
      data: {
        userId: params.userId,
        route: params.route,
        bookId: params.bookId ?? null,
        errorSummary: summary,
      },
    });
  } catch (err) {
    console.error("[ai-service-failure] failed to log", err);
  }
}

export function aiFailureResponse(
  userId: string,
  route: string,
  bookId: string | null | undefined,
  error: unknown,
): NextResponse {
  void reportAiServiceFailure({ userId, route, bookId, error });
  return NextResponse.json(
    {
      error: "AI_FAILURE",
      message: AI_FAILURE_MESSAGE,
      deducted: false,
    },
    { status: 502 },
  );
}

