import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Expected { enabled: boolean }" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { globalSpoilerProtection: body.enabled },
  });

  return NextResponse.json({ ok: true, globalSpoilerProtection: body.enabled });
}
