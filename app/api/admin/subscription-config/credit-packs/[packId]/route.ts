import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ packId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { packId } = await context.params;
  const exists = await prisma.creditPack.findUnique({ where: { id: packId } });
  if (!exists) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if ("credits" in body) {
    const credits = Number(body.credits);
    if (!Number.isInteger(credits) || credits < 1) {
      return NextResponse.json({ error: "credits must be a positive integer" }, { status: 400 });
    }
    data.credits = credits;
  }
  if ("active" in body) data.active = Boolean(body.active);
  if ("priceFree" in body) data.priceFree = Math.max(0, Math.trunc(Number(body.priceFree) || 0));
  if ("priceStandard" in body) data.priceStandard = Math.max(0, Math.trunc(Number(body.priceStandard) || 0));
  if ("pricePremium" in body) data.pricePremium = Math.max(0, Math.trunc(Number(body.pricePremium) || 0));
  if ("sortOrder" in body) data.sortOrder = Math.trunc(Number(body.sortOrder) || 0);
  if ("stripePriceId" in body) {
    data.stripePriceId =
      body.stripePriceId === null || body.stripePriceId === "" ? null : String(body.stripePriceId);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const pack = await prisma.creditPack.update({
    where: { id: packId },
    data: data as Parameters<typeof prisma.creditPack.update>[0]["data"],
  });

  return NextResponse.json({ pack });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { packId } = await context.params;
  await prisma.creditPack.delete({ where: { id: packId } });
  return NextResponse.json({ ok: true });
}
