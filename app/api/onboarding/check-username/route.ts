import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat } from "@/lib/username";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("username") ?? "";
  const username = raw.trim();

  if (!username) {
    return NextResponse.json({ available: false, valid: false });
  }

  if (!isValidUsernameFormat(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const excludeUserId = searchParams.get("excludeUserId")?.trim() || undefined;

  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({
    available: !existing,
    valid: true,
  });
}
