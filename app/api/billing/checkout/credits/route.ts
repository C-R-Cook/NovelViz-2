import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCreditPackCheckout } from "@/lib/stripe";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === UserRole.admin) {
    return NextResponse.json({ error: "Admins have unlimited usage" }, { status: 400 });
  }

  let body: { packId?: string };
  try {
    body = (await request.json()) as { packId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId.trim() : "";
  if (!packId) return NextResponse.json({ error: "packId is required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const url = await createCreditPackCheckout({
    userId: session.id,
    email: user.email,
    packId,
    successUrl: `${origin}/account?credits=success`,
    cancelUrl: `${origin}/account?credits=cancelled`,
  });

  if (!url) {
    return NextResponse.json(
      { error: "Credit purchases are not available for your plan or billing is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json({ url });
}
