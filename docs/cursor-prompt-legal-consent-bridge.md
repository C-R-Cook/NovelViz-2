# Cursor prompt: collapse legal consent to a single user-facing step

Paste this into Cursor Composer. Recommend Plan mode first since this touches several files across the register and auth/consent flow.

---

## Context

Today, legal consent is asked twice: once as UX-gating checkboxes on `/register` (before the Clerk account exists, so nothing is written to our DB yet), and again as the authoritative form on `/auth/consent` (after the account and DB user exist, where we actually write `over18ConfirmedAt`, `termsAcceptedAt`, `privacyAcceptedAt`, and the document version fields). The second ask is real and necessary architecturally, but showing the user the same checkboxes twice in immediate succession reads as broken.

Goal: keep both layers (pre-auth UX gate, post-auth authoritative DB write), but bridge them with a short-lived cookie so the human is only asked once. Also collapse the three on-screen checkboxes down to two: one combined "Terms of Service and Privacy Policy" checkbox, and a separate "I am 18 or older" checkbox, kept distinct because it's a factual attestation rather than agreement to a document. The database still records three separate timestamp fields regardless of UI grouping.

Reference docs already in the repo: `legal-consent-signup.md`, `sign-up-onboarding.md`, `auth-workflow.md`. Treat those as background, not as instructions to follow literally, since this prompt supersedes the "ask twice" part of `legal-consent-signup.md`.

---

## 1. Combine the checkboxes (UI only, no DB schema change)

In `components/auth/sign-up-legal-consent.tsx` (the shared checkbox UI used by both `/register` and the `/auth/consent` fallback form):

- Replace the three checkboxes with two:
  1. **"I am 18 years of age or older"**
  2. **"I agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy)"** (both links open in a new tab, same behavior as today)
- Internally, checking box 2 should set both `termsAccepted` and `privacyAccepted` to `true` together. Keep these as two separate boolean fields in the component's local state and in whatever payload it produces, even though there's only one checkbox driving both. Don't collapse them into a single boolean in the data layer, only in the UI.
- No change to `over18Confirmed`, it already maps one checkbox to one field.

Both `register-with-consent.tsx` and `app/auth/consent/consent-client.tsx` consume this shared component, so this change should apply in both places automatically. Visually confirm the `/auth/consent` fallback form (used when the bridge below doesn't apply) still looks correct with two checkboxes instead of three.

---

## 2. Add the bridge: capture intent at `/register`, before the account exists

### 2.1 New cookie helpers in `lib/legal-consent.ts`

Add, alongside the existing `TERMS_DOCUMENT_VERSION` / `PRIVACY_DOCUMENT_VERSION` constants and `userHasRequiredLegalConsent()`:

```ts
const LEGAL_CONSENT_INTENT_COOKIE = "legal_consent_intent";
const LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS = 15 * 60; // 15 minutes

type LegalConsentIntentPayload = {
  over18Confirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsDocumentVersion: string;
  privacyDocumentVersion: string;
  checkedAt: string; // ISO timestamp, set client-side at the moment of checking
};
```

Add functions:

- `setLegalConsentIntentCookie(payload: LegalConsentIntentPayload)` — server-side, sets an httpOnly, SameSite Lax cookie, `maxAge: LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS`, value is JSON-stringified payload.
- `readLegalConsentIntentCookie(): LegalConsentIntentPayload | null` — reads and parses the cookie server-side, returns `null` on missing/malformed.
- `isLegalConsentIntentValid(payload: LegalConsentIntentPayload | null): boolean` — returns `true` only if:
  - `payload` is not null
  - `over18Confirmed`, `termsAccepted`, and `privacyAccepted` are all `true`
  - `payload.termsDocumentVersion === TERMS_DOCUMENT_VERSION` and `payload.privacyDocumentVersion === PRIVACY_DOCUMENT_VERSION` (current constants, not the cookie's own values, this is the safeguard against documents changing mid-flow)
  - `payload.checkedAt` is no older than `LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS` (defensive check independent of the cookie's own browser-side expiry)
- `clearLegalConsentIntentCookie()` — deletes the cookie.

### 2.2 Refactor the write path into a shared function

Still in `lib/legal-consent.ts`, extract the actual DB write (currently inline in `app/api/legal-consent/route.ts`) into:

```ts
async function recordLegalConsent(userId: string): Promise<void>
```

This writes `over18ConfirmedAt`, `termsAcceptedAt`, `privacyAcceptedAt` (all to the same `now()`), plus `termsDocumentVersion = TERMS_DOCUMENT_VERSION` and `privacyDocumentVersion = PRIVACY_DOCUMENT_VERSION`, exactly as the route does today. Both the existing API route and the new auto-submit path (below) should call this same function, don't duplicate the write logic.

### 2.3 New public endpoint: `POST /api/legal-consent-intent`

New file `app/api/legal-consent-intent/route.ts`. No authentication required (this fires before the Clerk account exists). Accepts the same shape as `LegalConsentIntentPayload` minus `checkedAt` (server sets that itself, don't trust a client-supplied timestamp), validates all three booleans are `true` and that the document versions match current constants, then calls `setLegalConsentIntentCookie()`. Reject with 400 if booleans are missing/false or versions don't match current constants.

### 2.4 Call it from the register page

In `components/auth/register-with-consent.tsx`, when the user has both checkboxes checked (the same moment the Clerk widget currently becomes enabled), fire a call to `POST /api/legal-consent-intent` with the current checkbox state and the current document version constants (exposed to the client the same way they already are, or hardcoded client-side copies kept in sync, match whatever pattern `sign-up-legal-consent.tsx` already uses to reference the versions). This should not block or delay enabling the Clerk widget, fire it as a background call. If it fails, fail silently and let the normal `/auth/consent` fallback form handle it later, don't surface an error here since this layer is only ever a UX optimization, not a requirement.

---

## 3. Auto-submit at `/auth/consent` when the bridge is valid

In `app/auth/consent/page.tsx` (server component):

- Before rendering the existing `ConsentClient` form, read the bridge cookie via `readLegalConsentIntentCookie()` and check `isLegalConsentIntentValid()`.
- If valid: call `recordLegalConsent(userId)` directly (server-side, no client round trip needed), call `clearLegalConsentIntentCookie()`, and redirect onward exactly where the form's normal successful submit would redirect today (check `consent-client.tsx` for the current post-submit redirect target and match it). Render a brief transitional state if a redirect can't happen synchronously in this component (e.g. a one-line "Continuing..." message), don't flash the full form first.
- If invalid (missing, stale, version mismatch, or any boolean false): render `ConsentClient` exactly as today, no behavior change for that path.

This is the only place that needs to change for the auto-submit behavior. `app/auth/consent/consent-client.tsx` itself doesn't need new logic, it already handles the manual-submit case correctly, just update its checkbox UI per Section 1.

---

## 4. Things to double check

- Returning users signing in with no consent on file (pre-existing accounts created before this feature) will never have a bridge cookie set this session, so they should always land on the real form. Confirm this falls out naturally rather than needing special-casing.
- If `TERMS_DOCUMENT_VERSION` or `PRIVACY_DOCUMENT_VERSION` is bumped between when someone checks the boxes on `/register` and when they reach `/auth/consent` (extremely unlikely given how fast the flow runs, but possible if a deploy lands mid-session), the version check should correctly force the fallback form. Worth a quick manual test: temporarily bump one of the constants, complete `/register`, confirm `/auth/consent` shows the real form instead of auto-submitting.
- The intent cookie should never be readable or writable from client-side JS (httpOnly), since it doesn't need to be, only the server reads it.
- No Prisma migration needed, the `User` model fields from the original legal-consent feature are unchanged.

---

## 5. Manual test checklist

1. **Happy path:** `/register`, check both boxes, complete Clerk sign-up, confirm you land in onboarding without seeing the consent form again. Check the DB: `over18ConfirmedAt`, `termsAcceptedAt`, `privacyAcceptedAt` should all be set, with current document versions.
2. **Stale bridge:** check both boxes on `/register`, then wait past `LEGAL_CONSENT_INTENT_MAX_AGE_SECONDS` before finishing sign-up (or manually expire/delete the cookie in devtools), confirm the real consent form appears at `/auth/consent`.
3. **Version mismatch:** bump a document version constant after checking the boxes but before reaching `/auth/consent`, confirm the real form appears.
4. **Returning user, no consent on file:** simulate a pre-existing account without consent timestamps, sign in, confirm the real form appears (no bridge cookie exists for this session).
5. **Combined checkbox UI:** on both `/register` and the `/auth/consent` fallback form, confirm exactly two checkboxes are shown, and that checking the combined one results in both `termsAcceptedAt` and `privacyAcceptedAt` being written.
6. **Dev seed users:** confirm `devLegalConsentUpdate()` in `prisma/seed.ts` still works unchanged, this feature doesn't touch seeding.

---

## 6. Out of scope for this change

- No changes to the `User` schema or migrations.
- No changes to Clerk dashboard settings (still not using Clerk's native legal compliance feature, per the existing decision in `legal-consent-signup.md`).
- The "possible follow-ups" listed in `legal-consent-signup.md` (IP/user-agent capture, backfill campaign) are unrelated to this change and not addressed here.
