import { getCurrentUser } from "@/lib/auth";
import { findDbProfileForSession } from "@/lib/session-profile";
import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat } from "@/lib/username";
import { AgeRange, Gender } from "@db";
import { NextResponse } from "next/server";

function parseGender(raw: unknown): Gender | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw as Gender;
  if (Object.values(Gender).includes(v)) return v;
  return null;
}

function parseAgeRange(raw: unknown): AgeRange | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const v = raw as AgeRange;
  if (Object.values(AgeRange).includes(v)) return v;
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
  if (typeof b.username !== "string") {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const usernameRaw = b.username.trim().toLowerCase();
  if (!isValidUsernameFormat(usernameRaw)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: { username: { equals: usernameRaw, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const gender = parseGender(b.gender);
  if (b.gender !== null && b.gender !== undefined && b.gender !== "" && gender === null) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const ageRange = parseAgeRange(b.ageRange);
  if (b.ageRange !== null && b.ageRange !== undefined && b.ageRange !== "" && ageRange === null) {
    return NextResponse.json({ error: "Invalid age range" }, { status: 400 });
  }

  const subscribedToMailingList = Boolean(b.subscribedToMailingList);

  const me = await findDbProfileForSession(session);
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (me.username?.trim()) {
    return NextResponse.json({ error: "Profile already completed" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: me.id },
      data: {
        username: usernameRaw,
        gender,
        ageRange,
        subscribedToMailingList,
      },
    });
  } catch {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
