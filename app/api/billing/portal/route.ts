import { getCurrentUser } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/stripe";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === UserRole.admin) {
    return NextResponse.json({ error: "Admins do not have billing accounts" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const url = await createBillingPortalSession({
    userId: session.id,
    returnUrl: `${origin}/account`,
  });

  if (!url) {
    return NextResponse.json(
      { error: "No billing account found. Subscribe to a paid plan first." },
      { status: 404 },
    );
  }

  return NextResponse.json({ url });
}
