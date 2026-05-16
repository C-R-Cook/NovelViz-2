import { requireAdminApi } from "@/lib/admin-auth";
import { getBadgeDefinition } from "@/lib/badges";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
  const badgeKey = typeof b.badgeKey === "string" ? b.badgeKey.trim() : "";
  if (!badgeKey || !getBadgeDefinition(badgeKey)) {
    return NextResponse.json({ error: "Unknown badgeKey" }, { status: 400 });
  }

  const note = typeof b.note === "string" ? b.note.trim() || null : null;

  try {
    const badge = await prisma.userBadge.create({
      data: {
        userId,
        badgeKey,
        awardedBy: auth.user.clerkId,
        note,
      },
    });
    return NextResponse.json({
      badge: {
        ...badge,
        awardedAt: badge.awardedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Badge already awarded" }, { status: 409 });
    }
    throw err;
  }
}
