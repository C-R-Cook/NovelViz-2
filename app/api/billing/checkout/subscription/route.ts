import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSubscriptionCheckout } from "@/lib/stripe";
import { SubscriptionTier, UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === UserRole.admin) {
    return NextResponse.json({ error: "Admins do not require a subscription" }, { status: 400 });
  }

  let body: { tier?: string };
  try {
    body = (await request.json()) as { tier?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = body.tier;
  if (tier !== "free" && tier !== "standard" && tier !== "premium") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const url = await createSubscriptionCheckout({
    userId: session.id,
    email: user.email,
    tier: tier as SubscriptionTier,
    successUrl: `${origin}/account?checkout=success`,
    cancelUrl: `${origin}/account?checkout=cancelled`,
  });

  if (!url) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Contact support." },
      { status: 503 },
    );
  }

  return NextResponse.json({ url });
}
