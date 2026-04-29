import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookStatus, UserRole } from "@db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === UserRole.reader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
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
  if (typeof b.title !== "string" || b.title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof b.author !== "string" || b.author.trim() === "") {
    return NextResponse.json({ error: "author is required" }, { status: 400 });
  }

  let publishedYear: number | null = null;
  if ("publishedYear" in b && b.publishedYear !== null) {
    if (typeof b.publishedYear === "number" && Number.isInteger(b.publishedYear)) {
      publishedYear = b.publishedYear;
    } else {
      return NextResponse.json(
        { error: "publishedYear must be an integer or null" },
        { status: 400 },
      );
    }
  }

  const book = await prisma.book.create({
    data: {
      title: b.title.trim(),
      author: b.author.trim(),
      genre: typeof b.genre === "string" && b.genre.trim() ? b.genre.trim() : null,
      publishedYear,
      description:
        typeof b.description === "string" && b.description.trim()
          ? b.description.trim()
          : null,
      ownerId: dbUser.id,
      status: BookStatus.draft,
      isPublicDomain: false,
    },
  });

  return NextResponse.json({ book });
}
