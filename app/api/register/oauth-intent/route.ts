import {
  isLegalConsentIntentValid,
  readLegalConsentIntentCookie,
} from "@/lib/legal-consent";
import { NextResponse } from "next/server";

/** Read register-page OAuth bridge data (httpOnly cookie) for the SSO continue step. */
export async function GET() {
  const intent = await readLegalConsentIntentCookie();
  if (!intent || !isLegalConsentIntentValid(intent)) {
    return NextResponse.json({ error: "No valid register intent" }, { status: 404 });
  }

  return NextResponse.json({
    username: intent.username ?? null,
    consentComplete:
      intent.over18Confirmed && intent.termsAccepted && intent.privacyAccepted,
  });
}
