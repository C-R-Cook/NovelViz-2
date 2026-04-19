import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

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
  const data: {
    title?: string;
    author?: string;
    genre?: string | null;
    publishedYear?: number | null;
    description?: string | null;
  } = {};

  if ("title" in b) {
    if (typeof b.title !== "string") {
      return NextResponse.json({ error: "title must be a string" }, { status: 400 });
    }
    data.title = b.title;
  }
  if ("author" in b) {
    if (typeof b.author !== "string") {
      return NextResponse.json({ error: "author must be a string" }, { status: 400 });
    }
    data.author = b.author;
  }
  if ("genre" in b) {
    if (b.genre !== null && typeof b.genre !== "string") {
      return NextResponse.json({ error: "genre must be a string or null" }, { status: 400 });
    }
    data.genre = b.genre === null || b.genre === "" ? null : b.genre;
  }
  if ("publishedYear" in b) {
    if (b.publishedYear === null || b.publishedYear === "") {
      data.publishedYear = null;
    } else if (
      typeof b.publishedYear === "number" &&
      Number.isInteger(b.publishedYear)
    ) {
      data.publishedYear = b.publishedYear;
    } else {
      return NextResponse.json(
        { error: "publishedYear must be an integer, null, or empty" },
        { status: 400 },
      );
    }
  }
  if ("description" in b) {
    if (b.description !== null && typeof b.description !== "string") {
      return NextResponse.json(
        { error: "description must be a string or null" },
        { status: 400 },
      );
    }
    data.description =
      b.description === null || b.description === "" ? null : b.description;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one of: title, author, genre, publishedYear, description" },
      { status: 400 },
    );
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data,
    });
    return NextResponse.json({ book });
  } catch {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
}
