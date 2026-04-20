import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Create a new book shell for ingestion. Always starts as `draft`.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const book = await prisma.book.create({
    data: {
      title: b.title.trim(),
      author: b.author.trim(),
      status: "draft",
    },
  });

  return NextResponse.json({ book });
}
