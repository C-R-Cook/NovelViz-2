import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX = {
  publisherName: 200,
  websiteUrl: 2000,
  catalogueDescription: 12000,
  pseudonym: 120,
};

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0 || t.length > max) return null;
  return t;
}

function optionalTrim(v: unknown, max: number): string | null {
  if (v == null || (typeof v === "string" && v.trim() === "")) return "";
  return trimStr(v, max);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.reader) {
    return NextResponse.json({ error: "This form is available from the reader dashboard." }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, username: true },
  });
  if (!dbUser) {
    return NextResponse.json({ message: "Account not found." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const publisherName = trimStr(body.publisherName, MAX.publisherName);
  const catalogueDescription = trimStr(body.catalogueDescription, MAX.catalogueDescription);
  const websiteUrlRaw = optionalTrim(body.websiteUrl, MAX.websiteUrl);
  const pseudonymRaw = optionalTrim(body.pseudonym, MAX.pseudonym);

  if (!publisherName) {
    return NextResponse.json({ message: "Publisher or author name / imprint is required." }, { status: 400 });
  }
  if (!catalogueDescription) {
    return NextResponse.json({ message: "Please tell us about your catalogue." }, { status: 400 });
  }
  if (websiteUrlRaw === null) {
    return NextResponse.json({ message: "Website or social link is too long." }, { status: 400 });
  }
  if (pseudonymRaw === null) {
    return NextResponse.json({ message: "Pseudonym is too long." }, { status: 400 });
  }

  const email = dbUser.email.trim();
  if (!email.includes("@")) {
    return NextResponse.json({ message: "Your account email is invalid; please update it in Account settings." }, { status: 400 });
  }

  const name = dbUser.name?.trim() || email.split("@")[0] || "Reader";

  await prisma.partnerRequest.create({
    data: {
      userId: user.id,
      name,
      email,
      accountUsername: dbUser.username?.trim() || null,
      pseudonym: pseudonymRaw || null,
      publisherName,
      websiteUrl: websiteUrlRaw || null,
      catalogueNote: catalogueDescription,
    },
  });

  return NextResponse.json({ success: true });
}
