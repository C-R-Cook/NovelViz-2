import { getCurrentUser } from "@/lib/auth";
import { parseBookTargetingBody } from "@/lib/book-targeting-validation";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const book = await prisma.book.findFirst({ where: { id, deletedAt: null } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const isAdmin = dbUser.role === UserRole.admin;
  if (!isAdmin && book.ownerId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBookTargetingBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await prisma.book.update({
    where: { id },
    data: parsed,
    select: {
      featuredTargetAgeRanges: true,
      featuredTargetGenders: true,
      featuredTargetCountries: true,
      featuredTargetGenres: true,
    },
  });

  return NextResponse.json(updated);
}
