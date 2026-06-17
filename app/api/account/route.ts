import { getCurrentUser } from "@/lib/auth";
import { DeleteUserError, deleteUserCompletely } from "@/lib/delete-user";
import { parseDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat } from "@/lib/username";
import { AgeRange, BookGenre, Gender } from "@db";
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

function parseGender(raw: unknown): Gender | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw as Gender;
  if (Object.values(Gender).includes(v)) return v;
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
    username?: string;
    country?: string | null;
    ageRange?: AgeRange | null;
    gender?: Gender | null;
    genrePreferences?: string[];
    subscribedToMailingList?: boolean;
    globalSpoilerProtection?: boolean;
  } = {};

  if ("name" in b) {
    if (b.name === null || b.name === undefined || b.name === "") {
      data.name = null;
    } else if (typeof b.name === "string") {
      const parsed = parseDisplayName(b.name);
      if (!parsed) {
        return NextResponse.json({ error: "Please enter a valid full name" }, { status: 400 });
      }
      data.name = parsed;
    } else {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
  }

  if ("username" in b) {
    if (typeof b.username !== "string") {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const un = b.username.trim().toLowerCase();
    if (!isValidUsernameFormat(un)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const clash = await prisma.user.findFirst({
      where: {
        username: { equals: un, mode: "insensitive" },
        NOT: { id: session.id },
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    data.username = un;
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

  if ("gender" in b) {
    data.gender = parseGender(b.gender);
    if (b.gender !== null && b.gender !== undefined && b.gender !== "" && data.gender === null) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }
  }

  if ("subscribedToMailingList" in b) {
    if (typeof b.subscribedToMailingList !== "boolean") {
      return NextResponse.json({ error: "subscribedToMailingList must be boolean" }, { status: 400 });
    }
    data.subscribedToMailingList = b.subscribedToMailingList;
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
        username: true,
        email: true,
        role: true,
        country: true,
        ageRange: true,
        gender: true,
        genrePreferences: true,
        subscribedToMailingList: true,
        globalSpoilerProtection: true,
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

  try {
    await deleteUserCompletely(session.id, { preventLastAdmin: true });
  } catch (err) {
    if (err instanceof DeleteUserError) {
      const status =
        err.code === "not_found" ? 404 : err.code === "last_admin" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[api/account] DELETE failed", err);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
