import { getPublicTierPlans } from "@/lib/tier-limit-config";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [plans, creditPacks] = await Promise.all([
    getPublicTierPlans(),
    prisma.creditPack.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        credits: true,
        priceFree: true,
        priceStandard: true,
        pricePremium: true,
      },
    }),
  ]);

  return NextResponse.json({ plans, creditPacks });
}
