import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10)));

  const failures = await prisma.aiServiceFailure.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { email: true, username: true } },
    },
  });

  return NextResponse.json({
    failures: failures.map((f) => ({
      id: f.id,
      route: f.route,
      bookId: f.bookId,
      errorSummary: f.errorSummary,
      createdAt: f.createdAt.toISOString(),
      userEmail: f.user.email,
      username: f.user.username,
    })),
  });
}
