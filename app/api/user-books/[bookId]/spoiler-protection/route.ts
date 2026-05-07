import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection } from "@db";
import { NextResponse } from "next/server";

const VALID: SpoilerProtection[] = ["INHERIT", "PROTECTED", "UNLOCKED"];

type RouteContext = { params: Promise<{ bookId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await context.params;
  const body = (await request.json().catch(() => null)) as { setting?: unknown } | null;
  const setting = body?.setting as string | undefined;
  if (!setting || !VALID.includes(setting as SpoilerProtection)) {
    return NextResponse.json({ error: "Expected { setting: 'INHERIT' | 'PROTECTED' | 'UNLOCKED' }" }, { status: 400 });
  }

  const ub = await prisma.userBook.findFirst({
    where: { userId: session.id, bookId, isActive: true },
    select: { id: true },
  });
  if (!ub) {
    return NextResponse.json({ error: "Book not in library" }, { status: 404 });
  }

  await prisma.userBook.update({
    where: { id: ub.id },
    data: { spoilerProtection: setting as SpoilerProtection },
  });

  return NextResponse.json({ ok: true, spoilerProtection: setting });
}
