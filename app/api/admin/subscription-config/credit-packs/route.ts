import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const packs = await prisma.creditPack.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ packs });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const credits = Number(body.credits);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Number.isInteger(credits) || credits < 1) {
    return NextResponse.json({ error: "credits must be a positive integer" }, { status: 400 });
  }

  const pack = await prisma.creditPack.create({
    data: {
      name,
      credits,
      active: body.active !== false,
      priceFree: Math.max(0, Math.trunc(Number(body.priceFree) || 0)),
      priceStandard: Math.max(0, Math.trunc(Number(body.priceStandard) || 0)),
      pricePremium: Math.max(0, Math.trunc(Number(body.pricePremium) || 0)),
      sortOrder: Math.trunc(Number(body.sortOrder) || 0),
      stripePriceId: typeof body.stripePriceId === "string" ? body.stripePriceId : null,
    },
  });

  return NextResponse.json({ pack }, { status: 201 });
}
