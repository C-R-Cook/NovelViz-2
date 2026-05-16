import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string; grantId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId, grantId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || (body as { action?: string }).action !== "revoke") {
    return NextResponse.json({ error: "action must be revoke" }, { status: 400 });
  }

  const existing = await prisma.userGrant.findFirst({
    where: { id: grantId, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  const grant = await prisma.userGrant.update({
    where: { id: grantId },
    data: { expiresAt: new Date() },
  });

  return NextResponse.json({
    grant: {
      ...grant,
      startsAt: grant.startsAt.toISOString(),
      expiresAt: grant.expiresAt?.toISOString() ?? null,
      createdAt: grant.createdAt.toISOString(),
    },
  });
}
