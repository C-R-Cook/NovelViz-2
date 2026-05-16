import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string; badgeKey: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId, badgeKey } = await context.params;
  const decodedKey = decodeURIComponent(badgeKey);

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeKey: { userId, badgeKey: decodedKey } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Badge not found" }, { status: 404 });
  }

  await prisma.userBadge.delete({
    where: { userId_badgeKey: { userId, badgeKey: decodedKey } },
  });

  return NextResponse.json({ ok: true });
}
