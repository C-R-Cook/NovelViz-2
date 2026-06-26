import type { CurrentUser } from "@/lib/auth";
import { DEV_USERS_BY_ID } from "@/lib/dev-users";
import {
  LEGAL_CONSENT_INTENT_COOKIE,
  LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS,
  PRIVACY_DOCUMENT_VERSION,
  TERMS_DOCUMENT_VERSION,
} from "@/lib/legal-consent-constants";
import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username";
import { cookies } from "next/headers";

export {
  LEGAL_CONSENT_INTENT_COOKIE,
  LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS,
  PRIVACY_DOCUMENT_VERSION,
  TERMS_DOCUMENT_VERSION,
} from "@/lib/legal-consent-constants";

export type LegalConsentRecord = {
  over18ConfirmedAt: Date | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
};

export type LegalConsentIntentPayload = {
  over18Confirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsDocumentVersion: string;
  privacyDocumentVersion: string;
  /** Gallery username chosen on /register (OAuth bridge). */
  username?: string;
  checkedAt: string;
};

export function userHasRequiredLegalConsent(user: LegalConsentRecord): boolean {
  return (
    user.over18ConfirmedAt != null &&
    user.termsAcceptedAt != null &&
    user.privacyAcceptedAt != null
  );
}

const consentSelect = {
  over18ConfirmedAt: true,
  termsAcceptedAt: true,
  privacyAcceptedAt: true,
} as const;

export async function findLegalConsentForSession(
  session: CurrentUser,
): Promise<LegalConsentRecord | null> {
  const byClerk = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
    select: consentSelect,
  });
  if (byClerk) return byClerk;

  return prisma.user.findUnique({
    where: { id: session.id },
    select: consentSelect,
  });
}

export type RecordLegalConsentInput = {
  over18Confirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export function parseRecordLegalConsentBody(body: unknown): RecordLegalConsentInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const raw = body as Record<string, unknown>;
  if (raw.over18Confirmed !== true) return { error: "You must confirm you are 18 or older" };
  if (raw.termsAccepted !== true) return { error: "You must accept the Terms of Service" };
  if (raw.privacyAccepted !== true) return { error: "You must accept the Privacy Policy" };
  return {
    over18Confirmed: true,
    termsAccepted: true,
    privacyAccepted: true,
  };
}

export type LegalConsentIntentInput = Omit<LegalConsentIntentPayload, "checkedAt">;

export function parseLegalConsentIntentBody(body: unknown): LegalConsentIntentInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const raw = body as Record<string, unknown>;
  if (raw.over18Confirmed !== true) return { error: "You must confirm you are 18 or older" };
  if (raw.termsAccepted !== true) return { error: "You must accept the Terms of Service" };
  if (raw.privacyAccepted !== true) return { error: "You must accept the Privacy Policy" };
  if (raw.termsDocumentVersion !== TERMS_DOCUMENT_VERSION) {
    return { error: "Terms of Service version mismatch" };
  }
  if (raw.privacyDocumentVersion !== PRIVACY_DOCUMENT_VERSION) {
    return { error: "Privacy Policy version mismatch" };
  }

  let username: string | undefined;
  if (raw.username !== undefined && raw.username !== null && raw.username !== "") {
    if (typeof raw.username !== "string") return { error: "Invalid username" };
    username = normalizeUsername(raw.username);
    if (!isValidUsernameFormat(username)) return { error: "Invalid username" };
  }

  return {
    over18Confirmed: true,
    termsAccepted: true,
    privacyAccepted: true,
    termsDocumentVersion: TERMS_DOCUMENT_VERSION,
    privacyDocumentVersion: PRIVACY_DOCUMENT_VERSION,
    ...(username ? { username } : {}),
  };
}

export function buildLegalConsentUpdate(now: Date) {
  return {
    over18ConfirmedAt: now,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    termsDocumentVersion: TERMS_DOCUMENT_VERSION,
    privacyDocumentVersion: PRIVACY_DOCUMENT_VERSION,
  };
}

export async function recordLegalConsent(userId: string) {
  const consent = buildLegalConsentUpdate(new Date());
  await prisma.user.update({
    where: { id: userId },
    data: consent,
  });
  return consent;
}

/** Dev-only seed/backfill helper. */
export function devLegalConsentUpdate(now = new Date()) {
  return buildLegalConsentUpdate(now);
}

export async function setLegalConsentIntentCookie(input: LegalConsentIntentInput): Promise<void> {
  const payload: LegalConsentIntentPayload = {
    ...input,
    checkedAt: new Date().toISOString(),
  };
  const store = await cookies();
  store.set(LEGAL_CONSENT_INTENT_COOKIE, JSON.stringify(payload), {
    path: "/",
    maxAge: LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readLegalConsentIntentCookie(): Promise<LegalConsentIntentPayload | null> {
  const store = await cookies();
  const raw = store.get(LEGAL_CONSENT_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegalConsentIntentPayload;
    if (
      typeof parsed.over18Confirmed !== "boolean" ||
      typeof parsed.termsAccepted !== "boolean" ||
      typeof parsed.privacyAccepted !== "boolean" ||
      typeof parsed.termsDocumentVersion !== "string" ||
      typeof parsed.privacyDocumentVersion !== "string" ||
      typeof parsed.checkedAt !== "string" ||
      (parsed.username !== undefined &&
        (typeof parsed.username !== "string" || !isValidUsernameFormat(parsed.username)))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isLegalConsentIntentValid(payload: LegalConsentIntentPayload | null): boolean {
  if (!payload) return false;
  if (!payload.over18Confirmed || !payload.termsAccepted || !payload.privacyAccepted) {
    return false;
  }
  if (payload.termsDocumentVersion !== TERMS_DOCUMENT_VERSION) return false;
  if (payload.privacyDocumentVersion !== PRIVACY_DOCUMENT_VERSION) return false;
  const checkedAtMs = Date.parse(payload.checkedAt);
  if (Number.isNaN(checkedAtMs)) return false;
  const ageMs = Date.now() - checkedAtMs;
  return ageMs >= 0 && ageMs <= LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS * 1000;
}

export async function clearLegalConsentIntentCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: LEGAL_CONSENT_INTENT_COOKIE, path: "/" });
}

/** Apply register-page intent cookie to the DB user, if valid. Returns true when consent was recorded. */
export async function tryApplyLegalConsentIntent(userId: string): Promise<boolean> {
  const intent = await readLegalConsentIntentCookie();
  if (!isLegalConsentIntentValid(intent)) {
    return false;
  }

  await recordLegalConsent(userId);
  await clearLegalConsentIntentCookie();
  return true;
}

export async function getLegalConsentRedirectIfNeeded(
  session: CurrentUser,
): Promise<string | null> {
  if (process.env.NODE_ENV !== "production" && DEV_USERS_BY_ID[session.id]) {
    return null;
  }

  const consent = await findLegalConsentForSession(session);
  if (!consent || !userHasRequiredLegalConsent(consent)) {
    return "/auth/consent";
  }
  return null;
}
