import {
  parseLegalConsentIntentBody,
  setLegalConsentIntentCookie,
} from "@/lib/legal-consent";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseLegalConsentIntentBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await setLegalConsentIntentCookie(parsed);
  return NextResponse.json({ ok: true });
}
