import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgeRange, BookGenre } from "@db";
import { NextResponse } from "next/server";

const BOOK_GENRE_VALUES = new Set<string>(Object.values(BookGenre));

function parseGenrePreferences(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !BOOK_GENRE_VALUES.has(item)) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function parseAgeRange(raw: unknown): AgeRange | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw as AgeRange;
  if (Object.values(AgeRange).includes(v)) return v;
  return null;
}

export async function PATCH(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: {
    name?: string | null;
    country?: string | null;
    ageRange?: AgeRange | null;
    genrePreferences?: string[];
  } = {};

  if ("name" in b) {
    if (b.name === null || b.name === undefined) {
      data.name = null;
    } else if (typeof b.name === "string") {
      const trimmed = b.name.trim();
      data.name = trimmed.length ? trimmed : null;
    } else {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
  }

  if ("country" in b) {
    if (b.country === null || b.country === undefined || b.country === "") {
      data.country = null;
    } else if (typeof b.country === "string") {
      const c = b.country.trim().toUpperCase();
      if (c.length === 0) {
        data.country = null;
      } else if (/^[A-Z]{2}$/.test(c)) {
        data.country = c;
      } else {
        return NextResponse.json({ error: "Invalid country" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid country" }, { status: 400 });
    }
  }

  if ("ageRange" in b) {
    data.ageRange = parseAgeRange(b.ageRange);
    if (b.ageRange !== null && b.ageRange !== undefined && b.ageRange !== "" && data.ageRange === null) {
      return NextResponse.json({ error: "Invalid ageRange" }, { status: 400 });
    }
  }

  if ("genrePreferences" in b) {
    data.genrePreferences = parseGenrePreferences(b.genrePreferences);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        country: true,
        ageRange: true,
        genrePreferences: true,
        createdAt: true,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}

export async function DELETE() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.id;

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.generatedImage.deleteMany({ where: { userId } }),
    prisma.query.deleteMany({ where: { userId } }),
    prisma.readingProgress.deleteMany({ where: { userId } }),
    prisma.userBook.deleteMany({ where: { userId } }),
    prisma.bookRequest.deleteMany({ where: { userId } }),
    prisma.book.updateMany({ where: { ownerId: userId }, data: { ownerId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ success: true });
}
