import { handleStripeWebhook } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  try {
    await handleStripeWebhook(payload, signature);
  } catch (err) {
    console.error("[api/webhooks/stripe] error", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
