import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { invalidateTierLimitConfigCache } from "@/lib/tier-limit-config";
import { SubscriptionTier } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TIERS: SubscriptionTier[] = [
  SubscriptionTier.free,
  SubscriptionTier.standard,
  SubscriptionTier.premium,
];

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const tiers = await prisma.tierLimitConfig.findMany({ orderBy: { tier: "asc" } });
  return NextResponse.json({ tiers });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("tier" in body)) {
    return NextResponse.json({ error: "tier is required" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const tier = b.tier;
  if (tier !== "free" && tier !== "standard" && tier !== "premium") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const data: Record<string, unknown> = { updatedBy: admin.user.id };

  if ("queriesPerMonth" in b) {
    const v = b.queriesPerMonth;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0)) {
      return NextResponse.json({ error: "queriesPerMonth must be null or a non-negative integer" }, { status: 400 });
    }
    data.queriesPerMonth = v;
  }
  if ("imagesPerMonth" in b) {
    const v = b.imagesPerMonth;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0)) {
      return NextResponse.json({ error: "imagesPerMonth must be null or a non-negative integer" }, { status: 400 });
    }
    data.imagesPerMonth = v;
  }
  if ("allowedModels" in b) {
    const v = b.allowedModels;
    if (!Array.isArray(v) || !v.every((m) => typeof m === "string")) {
      return NextResponse.json({ error: "allowedModels must be string array" }, { status: 400 });
    }
    data.allowedModels = v.map((m) => (m as string).trim()).filter(Boolean);
  }
  if ("creditPurchasesEnabled" in b) {
    data.creditPurchasesEnabled = Boolean(b.creditPurchasesEnabled);
  }
  if ("creditCostQuery" in b) {
    const v = Number(b.creditCostQuery);
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json({ error: "creditCostQuery must be a positive integer" }, { status: 400 });
    }
    data.creditCostQuery = v;
  }
  if ("creditCostImage" in b) {
    const v = Number(b.creditCostImage);
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json({ error: "creditCostImage must be a positive integer" }, { status: 400 });
    }
    data.creditCostImage = v;
  }
  if ("displayPriceMonthly" in b) {
    const v = b.displayPriceMonthly;
    data.displayPriceMonthly = v === null || v === "" ? null : String(v);
  }
  if ("stripePriceId" in b) {
    const v = b.stripePriceId;
    data.stripePriceId = v === null || v === "" ? null : String(v);
  }

  if (Object.keys(data).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.tierLimitConfig.update({
    where: { tier: tier as SubscriptionTier },
    data: data as Parameters<typeof prisma.tierLimitConfig.update>[0]["data"],
  });

  invalidateTierLimitConfigCache();
  return NextResponse.json({ tier: updated });
}
