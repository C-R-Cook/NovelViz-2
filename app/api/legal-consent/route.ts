import { getCurrentUser } from "@/lib/auth";
import { parseRecordLegalConsentBody, recordLegalConsent } from "@/lib/legal-consent";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseRecordLegalConsentBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const consent = await recordLegalConsent(session.id);

  return NextResponse.json({
    over18ConfirmedAt: consent.over18ConfirmedAt.toISOString(),
    termsAcceptedAt: consent.termsAcceptedAt.toISOString(),
    privacyAcceptedAt: consent.privacyAcceptedAt.toISOString(),
    termsDocumentVersion: consent.termsDocumentVersion,
    privacyDocumentVersion: consent.privacyDocumentVersion,
  });
}
