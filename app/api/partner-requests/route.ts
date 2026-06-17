import { getCurrentUser } from "@/lib/auth";
import {
  AdminEmailCategory,
  sendAdminEmail,
} from "@/lib/admin-email";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX = {
  publisherName: 200,
  websiteUrl: 2000,
  catalogueDescription: 12000,
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

  const publisherNameRaw = optionalTrim(body.publisherName, MAX.publisherName);
  const catalogueDescription = trimStr(body.catalogueDescription, MAX.catalogueDescription);
  const websiteUrlRaw = optionalTrim(body.websiteUrl, MAX.websiteUrl);

  if (publisherNameRaw === null) {
    return NextResponse.json({ message: "Publisher name is too long." }, { status: 400 });
  }
  if (!catalogueDescription) {
    return NextResponse.json({ message: "Please tell us about your catalogue." }, { status: 400 });
  }
  if (websiteUrlRaw === null) {
    return NextResponse.json({ message: "Website or social link is too long." }, { status: 400 });
  }

  const publisherName = publisherNameRaw || null;

  const email = dbUser.email.trim();
  if (!email.includes("@")) {
    return NextResponse.json({ message: "Your account email is invalid; please update it in Account settings." }, { status: 400 });
  }

  const name = dbUser.name?.trim();
  if (!name) {
    return NextResponse.json(
      { message: "Please add your full name in Account settings before applying." },
      { status: 400 },
    );
  }

  await prisma.partnerRequest.create({
    data: {
      userId: user.id,
      name,
      email,
      accountUsername: dbUser.username?.trim() || null,
      publisherName,
      websiteUrl: websiteUrlRaw || null,
      catalogueNote: catalogueDescription,
    },
  });

  sendAdminEmail({
    category: AdminEmailCategory.PARTNER_REQUEST,
    subjectDetail: publisherName ? `${publisherName} - ${name}` : `Partner request - ${name}`,
    bodyLines: [
      { label: "Source", value: "Dashboard form" },
      { label: "Name", value: name },
      { label: "Email", value: email },
      ...(dbUser.username?.trim()
        ? [{ label: "Username", value: dbUser.username.trim() }]
        : []),
      ...(publisherName ? [{ label: "Publisher", value: publisherName }] : []),
      ...(websiteUrlRaw ? [{ label: "Website", value: websiteUrlRaw }] : []),
      { label: "Catalogue", value: catalogueDescription },
    ],
  });

  return NextResponse.json({ success: true });
}
