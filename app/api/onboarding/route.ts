import { getCurrentUser } from "@/lib/auth";
import { parseUserAgeRange } from "@/lib/age-range";
import { parseDisplayName } from "@/lib/display-name";
import { findDbProfileForSession } from "@/lib/session-profile";
import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat } from "@/lib/username";
import { BookGenre, Gender } from "@db";
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

function parseCountry(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  if (c.length === 0) return null;
  if (/^[A-Z]{2}$/.test(c)) return c;
  return null;
}

function parseGender(raw: unknown): Gender | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw as Gender;
  if (Object.values(Gender).includes(v)) return v;
  return null;
}

export async function POST(request: Request) {
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
  const genrePreferences = parseGenrePreferences(b.genrePreferences);
  if (genrePreferences.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one genre" },
      { status: 400 },
    );
  }

  const gender = parseGender(b.gender);
  if (b.gender !== null && b.gender !== undefined && b.gender !== "" && gender === null) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const ageRange = parseUserAgeRange(b.ageRange);
  if (b.ageRange !== null && b.ageRange !== undefined && b.ageRange !== "" && ageRange === null) {
    return NextResponse.json({ error: "Invalid age range" }, { status: 400 });
  }

  const countryParsed = parseCountry(b.country);
  if (b.country !== undefined && b.country !== null && b.country !== "" && countryParsed === null) {
    return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  }

  const subscribedToMailingList = Boolean(b.subscribedToMailingList);

  const me = await findDbProfileForSession(session);
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nameParsed = parseDisplayName(b.name);
  const needsName = !me.name?.trim();
  if (needsName && !nameParsed) {
    return NextResponse.json({ error: "Please enter your full name" }, { status: 400 });
  }
  if (b.name !== undefined && b.name !== null && b.name !== "" && !nameParsed) {
    return NextResponse.json({ error: "Please enter a valid full name" }, { status: 400 });
  }

  const hasUsername = Boolean(me.username?.trim());
  const legacyGenresOnly = hasUsername && me.genrePreferences.length === 0;

  if (hasUsername && me.genrePreferences.length > 0) {
    return NextResponse.json({ error: "Profile already completed" }, { status: 400 });
  }

  if (!legacyGenresOnly) {
    if (typeof b.username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const usernameRaw = b.username.trim().toLowerCase();
    if (!isValidUsernameFormat(usernameRaw)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: {
        username: { equals: usernameRaw, mode: "insensitive" },
        NOT: { id: me.id },
      },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    try {
      await prisma.user.update({
        where: { id: me.id },
        data: {
          username: usernameRaw,
          gender,
          ageRange,
          subscribedToMailingList,
          genrePreferences,
          ...(nameParsed ? { name: nameParsed } : {}),
          ...(countryParsed !== undefined ? { country: countryParsed } : {}),
        },
      });
    } catch {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  } else {
    try {
      await prisma.user.update({
        where: { id: me.id },
        data: {
          gender,
          ageRange,
          subscribedToMailingList,
          genrePreferences,
          ...(nameParsed ? { name: nameParsed } : {}),
          ...(countryParsed !== undefined ? { country: countryParsed } : {}),
        },
      });
    } catch {
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
