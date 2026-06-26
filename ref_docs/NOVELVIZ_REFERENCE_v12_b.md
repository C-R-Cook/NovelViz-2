# NovelViz Reference
**Version 12** — Updated June 2026 (custom email sign-up redesign + account enforcement system finalized)

---

## Product

Chapter-gated AI companion for book readers. Users declare book ownership and track reading progress (no in-app reading — avoids licensing). AI features strictly limited to chapters reached. Core insight: AI should never spoil books.

**Audiences:** Readers (spoiler-free AI), Partners/publishers (engagement data + ad targeting), Advertisers (active readers with known genre prefs).

**Revenue:** Freemium subscriptions, publisher advertising, affiliate retailer links (Amazon/Bookshop.org), publisher partnerships.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript |
| Styling | Tailwind CSS + CSS custom properties (`var(--accent)` etc). 6 dev palettes. |
| Auth | Clerk (prod). Mock cookie-based role switcher (dev) — 3 DB records per role. |
| DB | Neon PostgreSQL (serverless) + pgvector. Prisma 7. |
| Prisma client | Generated to `app/generated/prisma`. Imported via `@db` alias in most files; some files use `@/lib/prisma`. Seed uses `tsx` not ts-node. |
| Images | Cloudinary — covers at `novelviz/covers/[bookId]`, gallery images at `novelviz/gallery/[imageId]`, 2:3 crop fit for covers. |
| AI — embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| AI — Q&A + enrichment | Anthropic Claude (`ANTHROPIC_MODEL` env var) |
| AI — image gen | fal.ai — role-gated model selection |
| Hosting | Vercel. `dev` branch = staging, `main` = production. |
| Domain | novelviz.com (Namecheap DNS → Vercel) |
| Email | Resend (`resend ^6.12.4`) — admin operational alerts only. All calls go through `lib/admin-email.ts`. |

**Key libraries:** `@anthropic-ai/sdk`, `openai`, `@fal-ai/client`, `cloudinary`, `@clerk/nextjs`, `@prisma/adapter-neon`, `jszip`, `fast-xml-parser`, `react-markdown`, `recharts`, `react-calendar`, `i18n-iso-countries`, `resend`

---

## Environment Variables

```
DATABASE_URL                        # Neon pooled
DIRECT_URL                          # Neon direct (required for migrations)
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_WEBHOOK_SECRET
ANTHROPIC_API_KEY
ANTHROPIC_MODEL                     # e.g. claude-sonnet-4-5
OPENAI_API_KEY
OPENAI_ADMIN_API_KEY                # OpenAI admin key for usage/cost API
CLOUDINARY_URL
FAL_API_KEY                         # Inference key — image generation
FAL_ADMIN_API_KEY                   # Admin key — usage/billing API only
GUTENBERG_ADMIN_USER_ID             # User.id of an admin for Gutenberg ingest ownership
NEON_PROJECT_ID                     # Optional — Neon console project id
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_FREE                # Optional fallback; primary source is TierLimitConfig.stripePriceId
STRIPE_PRICE_ID_STANDARD
STRIPE_PRICE_ID_PREMIUM
BETA_MODE                           # Set to "true" to bypass quota enforcement (usage still recorded)
RESEND_API_KEY                      # Resend API authentication
ADMIN_NOTIFICATION_EMAIL            # Admin destination inbox (e.g. hello@novelviz.com)
EMAIL_FROM                          # Verified Resend sender (e.g. NovelViz <notifications@novelviz.com>)
NEXT_PUBLIC_APP_URL                 # Canonical site URL -- used for admin links in email bodies
```

**Admin key notes:**
- `OPENAI_ADMIN_API_KEY` — separate from `OPENAI_API_KEY`. Create at `platform.openai.com/settings/organization/admin-keys`.
- `FAL_ADMIN_API_KEY` — must be an Admin key (not inference key). Regular inference keys return 403 on usage endpoints.
- Anthropic usage API requires an organisation account — not available on individual accounts. Cost estimates computed from stored token counts instead.
- Neon consumption API requires Launch plan or above. Currently on free tier — upgrade before beta.

---

## Database Environments

Use **separate Postgres databases** for production and local development.

**Two Neon branches:**
- `production` (or `main`) — live site data
- `development` — local dev, experiments, `prisma db seed`, Gutenberg CLI tests

**Vercel env vars by environment:**
- Production: production Neon branch (pooled `DATABASE_URL` + direct `DIRECT_URL`), Clerk production keys
- Development/local: development Neon branch, Clerk development instance keys

**Local `.env.local`:** Never commit. `DATABASE_URL` must point at the dev branch. `DIRECT_URL` must be set for migrations. `npm run dev` and all `npx tsx scripts/...` commands only touch dev data when this is correct.

**Pull from Vercel:** `vercel env pull .env.local --environment=development` then verify `DATABASE_URL` is the dev branch, not production.

**Migrations:**
- `npx prisma migrate deploy` — reliable path for this repo (shadow DB issue with `migrate dev`)
- Production migrations run automatically via `scripts/vercel-build.sh` on Vercel production deploys
- Never put production `DATABASE_URL` in `.env.local`

**First-time dev DB setup:**
```bash
npx prisma migrate deploy
npx prisma db seed
```
Seed creates `dev_user_admin`, readers, partners, sample books.

---

## Authentication

NovelViz uses Clerk for accounts (password hashing, email delivery, sessions, JWT). App DB (`User` row keyed by `clerkId`) is synced via webhook and a server-side fallback on first request.

**v12 redesign:** sign-up no longer uses Clerk's embedded `<SignUp />` widget. The previous design placed legal checkboxes above a locked Clerk widget, and many users also hit a second agreement page and a stuck `/auth/after` screen after verification — patching that flow repeatedly didn't fix the underlying experience, so it was rebuilt. Sign-up is now a single NovelViz-branded email/password form built on Clerk's headless `useSignUp()` API (`@clerk/nextjs/legacy`), with inline email verification on the same page. **Sign-in is unchanged** — still Clerk's `<SignIn />` widget at `/login`.

### Sign-up (`/register`)

**Flow:** email → password → two consent checkboxes (18+, Terms+Privacy) → submit → inline verification code on the same page → `setActive()` → consent written to DB → `/onboarding/plan`.

1. User fills email, password (≥8 chars), and both consent checkboxes on `CustomEmailSignUp` — submit stays disabled until all three are valid.
2. `signUp.create()` + `prepareEmailAddressVerification()` (Clerk) creates the account and sends a verification email.
3. User enters the code inline (no separate Clerk-branded page); `attemptEmailAddressVerification()` + `setActive()` activates the session.
4. `POST /api/legal-consent` writes all three consent timestamps to the DB.
5. `GET /api/auth/session-ready` polls (fetch-based, not a page-reload loop) until the DB `User` row exists, then redirects — typically to `/onboarding/plan`.

**No social/OAuth sign-up** on `/register` for now — email-only, to keep the first-run experience simple.

**Legal consent — register happy path:** the **single consent moment** happens once, at register. Three timestamped, versioned attestations are stored in NovelViz's own DB (not Clerk's built-in compliance checkbox, which can't satisfy 18+ confirmation or an audit trail):

| Field | Meaning |
|---|---|
| `over18ConfirmedAt` | User confirmed 18+ |
| `termsAcceptedAt` | Terms of Service accepted |
| `privacyAcceptedAt` | Privacy Policy accepted |
| `termsDocumentVersion` | Version of Terms in effect (currently `2026-06-25`) |
| `privacyDocumentVersion` | Version of Privacy in effect (currently `2026-06-25`) |

**Legal consent — fallback paths** (legacy accounts, or DB write failure on the happy path):
- **Intent cookie** `legal_consent_intent` (15 min) — set when a sign-in lands on `/auth/after` without DB consent already present.
- **`/auth/consent`** — manual checkbox form if the cookie bridge fails.

This replaces the old bridge-cookie-only consent pattern; the cookie bridge is now a fallback for edge cases, not the primary path.

### Sign-in (`/login`) — unchanged

1. `/login` → Clerk `<SignIn />` widget.
2. `/auth/after` → provisions DB user if needed (fetch-based polling via `/api/auth/session-ready`, not the old reload loop), applies the consent fallback if needed, routes via `resolvePostAuthRedirect()`.
3. Destination: `/library` if onboarding complete, else `/onboarding/plan` or `/onboarding/preferences`.

### Onboarding (after either path)

- `/onboarding/plan` — plan selection (step 3)
- `/onboarding/preferences` — username & genres (step 4)
- `/onboarding` — router only (no UI); reads session and redirects to correct step

**Onboarding completion rule:** a user is considered onboarded when they have **both** a `username` and **at least one `genrePreference`** on their `User` record.

**Onboarding stage logic** (`lib/session-profile.ts` → `getOnboardingStage()`):

| Stage | Condition |
|---|---|
| `plan` | No genre prefs **and** no username **and** plan cookie not set |
| `preferences` | No genre prefs **but** username exists **or** plan cookie is set |
| `complete` | Username set **and** at least one genre preference exists |

**Plan step bridge cookie** (`onboarding_plan_done=1`, `lib/onboarding-cookies.ts`) — separate from the legal-consent intent cookie above: set by `completePlanStep()`, cleared after preferences submit. Max age 24h, SameSite Lax. Required because username doesn't exist yet when the plan step completes — without it, a user with no username would loop back to `/onboarding/plan`.

**DB user creation:**
- Primary: Clerk webhook `user.created` → `POST /api/webhooks/clerk`
- Fallback: `ensureCurrentUser()` upserts from Clerk profile on first authenticated request if the webhook was missed
- New users get: email + name from Clerk, default `usagePeriodAnchor` from sign-up day (capped at 28), default role `reader`

**Access control:**
- Clerk middleware (`proxy.ts`) protects `/onboarding(.*)`, `/library(.*)`, `/account(.*)` etc., and sets `x-pathname` / `x-url` headers used by account-enforcement route guards (see Account Enforcement section)
- Reader layout (`app/(reader)/layout.tsx`) requires Clerk session + resolved `User` — otherwise redirect to `/auth/after`
- Reader app shell (`app/(reader)/(app)/layout.tsx`) additionally requires completed onboarding; incomplete users redirected via `getOnboardingRedirectUrl()`
- Dev only: `dev_user_id` cookie bypasses Clerk in middleware. Does not exist in production.

**Legacy / edge cases:**
- User has username but no genres (legacy account) → preferences page in genres-only mode (username field read-only)
- Signed-in user opens `/register` → redirect to post-auth destination
- Already-complete user hits any `/onboarding` URL → redirect to `/library`

**Routes:**

| URL | Role |
|---|---|
| `/register` | New account — custom NovelViz-branded email/password form |
| `/sign-up` | Legacy redirect → `/register` |
| `/login` | Returning users — Clerk `<SignIn />` |
| `/sign-in` | Legacy redirect → `/login` |
| `/auth/after` | Post–sign-in provisioning & routing (not used on the register happy path) |
| `/auth/consent` | Fallback consent page (legacy accounts, failed consent write) |
| `/onboarding/plan` | Plan selection |
| `/onboarding/preferences` | Username & genres |
| `/library` | Reader home when onboarding complete |

**Deploy checklist:** Clerk production instance with standard email + password + email verification enabled (no special dashboard mode needed for the headless form), webhook at `/api/webhooks/clerk` with `user.created` event, `CLERK_WEBHOOK_SECRET` in env. Clerk global URLs set in `app/layout.tsx`: `signInUrl="/login"`, `signUpUrl="/register"`.

**⚠ Webhook URL must use `www`:** Vercel redirects the apex domain (`novelviz.com`) to `www.novelviz.com` with a 307. Clerk/Svix does not re-POST after a redirect, so every delivery silently fails. The Clerk Dashboard webhook endpoint must be set to `https://www.novelviz.com/api/webhooks/clerk` — not the apex. This applies to any third-party service that POSTs to NovelViz (Stripe webhooks must also use `www` — verify when wiring Stripe).

---

## Route Structure

```
app/
├── (public)/         → /discover (/books redirects here), /gallery, /gallery/[bookId],
│                        /faq, /contact, /privacy, /terms
├── (reader)/
│   ├── onboarding/   → /onboarding (router), /onboarding/plan, /onboarding/preferences
│   └── (app)/        → /library, /dashboard, /reader/[bookId], /account
├── account/          → /account/suspended, /account/terminated
├── auth/
│   ├── after/        → /auth/after (post–sign-in provisioning + routing)
│   └── consent/      → /auth/consent (fallback legal-consent form)
├── (partner)/        → /partner/books/new, /partner/books/[id], /partner/books/[id]/stats
├── admin/            → /admin/books, /admin/books/[id], /admin/requests, /admin/stats,
│                        /admin/gutenberg-import, /admin/cover-refresh,
│                        /admin/subscription-settings, /admin/featured-settings,
│                        /admin/users, /admin/users/[userId]
├── register/         → /register (custom NovelViz email/password sign-up)
├── login/            → /login (Clerk sign-in)
├── dev/              → /dev/onboarding-preview (404 in production)
└── api/
    ├── query/
    ├── imagine/
    ├── onboarding/           → profile save + username check
    ├── legal-consent/        → authoritative consent write (register happy path)
    ├── billing/
    │   ├── checkout/subscription/
    │   ├── checkout/credits/
    │   └── portal/
    ├── webhooks/clerk/
    ├── webhooks/stripe/
    ├── auth/
    │   └── session-ready/    → provisioning poll (sign-up + sign-in)
    ├── account/
    │   ├── usage/
    │   ├── credits/
    │   └── appeal/            → user suspension-appeal submission
    ├── partner/
    │   └── books/[bookId]/targeting/
    └── admin/
        ├── subscription-config/tiers/
        ├── subscription-config/credit-packs/[id]/
        ├── featured-scoring/
        │   ├── config/
        │   └── history/
        ├── books/[id]/targeting-preview/
        ├── users/
        └── users/[userId]/
            └── enforcement/   → suspend / terminate / restore / approve / deny appeal
```

---

## Roles

- `reader` — browse, library, Q&A, image gen, gallery, dashboard
- `partner` — reader + upload books, manage catalogue, view own book stats, request image featuring
- `admin` — everything + moderation, all stats, approve/reject submissions, approve/reject feature requests, admin tools
- Hierarchy: reader ⊂ partner ⊂ admin

**Role vs. Tier distinction:** `UserRole` (reader / partner / admin) controls platform access type. `SubscriptionTier` (free / standard / premium) controls AI action allowances. These are independent. Admins bypass quota checks entirely regardless of tier.

---

## Schema

**User:** `clerkId`, `username` (public), `name`, `email`, `role` (UserRole), `gender`, `ageRange`, `country`, `genrePreferences`, `subscribedToMailingList`, `globalSpoilerProtection` (bool, default true), `subscriptionTier` (SubscriptionTier), `subscriptionStatus` (SubscriptionStatus), `stripeCustomerId`, `stripeSubscriptionId`, `usagePeriodAnchor` (day-of-month int), `usagePeriodStart` (DateTime — set by Stripe webhook), `queriesLimitFloor` (Int?), `imagesLimitFloor` (Int?), `queriesUnlimitedFloor` (Bool?), `over18ConfirmedAt` (DateTime?), `termsAcceptedAt` (DateTime?), `privacyAcceptedAt` (DateTime?), `termsDocumentVersion` (String?), `privacyDocumentVersion` (String?), `accountStatus` (AccountStatus, default active), `suspendedAt` (DateTime?), `terminatedAt` (DateTime?), `statusReason` (String?), `activeSuspensionLogId` (String? — FK to the `ModerationLog` row anchoring the current suspension)

**Book:** `title`, `author`, `description`, `genre` (BookGenre), `status` (BookStatus), `ownerId`, `coverImageUrl`, `isPublicDomain`, `deletedAt` (soft delete), `publishedYear` (Int?), `openLibraryKey` (String?), `gutenbergId` (Int? @unique), `ingestionPromptTokens` (Int?), `ingestionCompletionTokens` (Int?), `listingPreferenceAfterReview` (String? — `"published"` or `"unlisted"`), `rejectionReason` (String?), `internalNotes` (String?), `featuredTargetAgeRanges` (String[] @default([])), `featuredTargetGenders` (String[] @default([])), `featuredTargetCountries` (String[] @default([])), `featuredTargetGenres` (String[] @default([]))

**Chapter:** `bookId`, `sequenceNumber`, `title`, `rawText`

**Chunk:** `chapterId`, `bookId` (denormalised for pgvector perf), `sequenceNumber`, `content` (~500 tokens), `embedding` (1536-dim vector)

**UserBook:** User↔Book join. `spoilerProtection` (SpoilerProtection enum, default INHERIT), `isActive` (bool)

**ReadingProgress:** `userId`, `bookId`, `currentChapter`

**Query:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `questionText`, `responseText`, `promptTokens`, `completionTokens`, `embeddingTokens`

**GeneratedImage:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `userPrompt`, `fullPrompt`, `imageUrl` (always Cloudinary URL), `isPublic` (default false), `isFeatured` (default false), `model`, `promptTokens`, `completionTokens`, `embeddingTokens`, `subjectTokens`

Note: `GeneratedImage.isFeatured` controls gallery image featuring. `Book` has no `isFeatured` field — the discover carousel pool is popularity-based, not admin-toggled.

**TierLimitConfig:** One row per tier. `tier` (SubscriptionTier), `queriesPerMonth` (Int? — null = unlimited), `imagesPerMonth` (Int? — null = unlimited), `allowedModels` (String[]), `creditPurchasesEnabled` (Bool), `creditCostQuery` (Int), `creditCostImage` (Int), `displayPriceMonthly` (String), `stripePriceId` (String?). Admin-editable via `/admin/subscription-settings`. 30-second in-memory cache in `lib/tier-limit-config.ts`. **Single source of truth for all tier limits — no hardcoded values anywhere.**

**CreditPack:** Admin-configured one-time purchase packs. `name`, `credits` (Int), `active` (Bool), `priceFree` (Int — cents), `priceStandard` (Int — cents), `pricePremium` (Int — cents), `stripePriceId` (String?), `sortOrder` (Int). Tier-differentiated pricing.

**CreditTransaction:** Immutable credit ledger. `userId`, `amount` (Int — positive = add, negative = spend), `reason` (CreditTransactionReason), `bookId` (nullable), `creditPackId` (nullable), `stripePaymentIntentId` (nullable — for idempotency), `grantedBy` (nullable), `note` (String?). **Current balance = `SUM(amount)` for a given user.** Never use a mutable balance field.

**UserQuotaOverride:** Per-user limit override, takes precedence over global tier config. `userId`, `queriesLimit` (Int?), `imagesLimit` (Int?), `expiresAt` (DateTime?), `reason`, `grantedBy`.

**UserGrant:** Bonus grants. `userId`, `grantType` (GrantType), `source` (GrantSource), `tierValue` (SubscriptionTier?), `bonusAmount` (Int?), `usedAmount` (Int), `expiresAt` (DateTime?).

**AiServiceFailure:** Failure log. `userId`, `route`, `bookId` (nullable), `errorSummary` (String, max 2000 chars). Indexed by `createdAt`.

**FeatureRequest:** `imageId`, `requestedBy`, `status` (FeatureRequestStatus), `reviewedBy` (nullable), `createdAt`, `updatedAt`. `@@unique([imageId])`.

**BookRequest:** user-submitted catalogue requests

**Like:** `@@unique([userId, imageId])`

**Comment:** `id`, `imageId`, `userId`, `content`, `status` (CommentStatus, default VISIBLE), `spoilerGateChapter` (Int?), `spoilerModerationAt` (DateTime?), `spoilerScanDebug` (Json?), `createdAt`, `updatedAt`.

**Notification:** `id`, `userId`, `type` (NotificationType), `message`, `link`, `read` (bool, default false), `createdAt`. Retained for 30 days.

**FeaturedScoringConfig:** Singleton (id = `"singleton"`). Holds all scoring weight integers for the discover carousel personalisation engine. Falls back to `DEFAULT_SCORING_WEIGHTS` in `lib/featured-scoring-weights.ts` if row absent. 60-second in-memory cache. See Featured Book Scoring section for full field list.

**FeaturedScoringHistory:** Immutable audit log. One row written on every admin save of scoring weights. `savedAt`, `savedBy` (User.id), `savedByName` (denormalised), plus a mirror of every weight field from `FeaturedScoringConfig`. `@@index([savedAt])`. Never updated or deleted.

**ModerationLog (strike):** Immutable, permanent moderation incident record — any admin action, user flag, system auto-suspend, etc. `userId`, `source` (admin / auto / user_flag / system), `aupCategory` (optional category label), `summary` (human-readable), `commentId` / `queryId` / `imageId` (optional links to the content involved), `createdBy` (admin user id, nullable), `flaggedByUserId` (reporter, nullable), `createdAt`. **Strike count for a user is `COUNT` of their `ModerationLog` rows — not a separate counter column.**

**ModerationAppeal:** User-submitted appeal, permanently linked to the specific suspension strike it responds to. `userId`, `status` (AppealStatus), `userMessage` (free text), `moderationLogId` (FK — the strike that caused the current suspension), `resolvedAt` / `resolvedBy` / `resolutionNote`.

### Enums

```
BookStatus:              draft | processing | ready_for_review | pending_review | published | unlisted | rejected
BookGenre:               fantasy | horror | romance | adventure | mystery | science_fiction | historical_fiction | literary_fiction | thriller | childrens_fiction | classic_literature | gothic | crime | biography | short_stories
UserRole:                reader | partner | admin
SubscriptionTier:        free | standard | premium
SubscriptionStatus:      active | cancelled | past_due | trialing
Gender:                  male | female | non_binary | other | prefer_not_to_say
SpoilerProtection:       INHERIT | PROTECTED | UNLOCKED
FeatureRequestStatus:    PENDING | APPROVED | REJECTED
CommentStatus:           VISIBLE | HIDDEN_SPOILER | PENDING_CONTENT_REVIEW | DELETED
NotificationType:        COMMENT_HIDDEN_PENDING | COMMENT_REINSTATED | COMMENT_RELEASED |
                         COMMENT_SPOILER_REMOVED | COMMENT_SPOILER_CONFIRMED_GATED |
                         COMMENT_REPORTED_TO_AUTHOR | COMMENT_FLAGGED_FOR_MODERATION |
                         COMMENT_FLAGGED_RESTORED | COMMENT_FLAGGED_REMOVED |
                         BOOK_APPROVED | BOOK_REJECTED |
                         FEATURE_REQUEST_APPROVED | FEATURE_REQUEST_REJECTED
GrantType:               TIER_UPGRADE | QUERY_BONUS | IMAGE_BONUS
GrantSource:             ADMIN | SYSTEM | PURCHASE
CreditTransactionReason: PURCHASE | SPEND_QUERY | SPEND_IMAGE | ADMIN_ADJUST
AccountStatus:           active | suspended | terminated
ModerationLogSource:     admin | auto | user_flag | system
AppealStatus:            pending | approved | denied
```

### Key architectural decisions

- `chapterNumberAtTime` — int snapshot on Query + GeneratedImage, NOT a foreign key.
- Soft delete on Book via `deletedAt`. Soft delete on Comment via `status: DELETED`.
- EPUB parsed via JSZip + `toc.ncx` navMap for exact chapter anchors. `.txt` fallback.
- pgvector in same DB as content — no separate vector store needed.
- Design tokens via CSS custom properties — enables palette switching.
- Dev role switcher uses cookies so both client and server components see correct role.
- Three independent DB records per role provides genuine isolation when testing.
- `GeneratedImage.imageUrl` is always a Cloudinary URL. fal.ai temporary CDN URL is immediately re-uploaded before saving to DB.
- `FeatureRequest.@@unique([imageId])` — one active request per image. REJECTED requests are deleted before allowing re-request.
- Comments are not gated by chapter number structurally — spoiler detection is semantic, handled by async Claude scan.
- `spoilerModerationAt` distinguishes "scan flagged, pending admin review" from "admin confirmed spoiler, permanently gated".
- Notifications retained 30 days from `createdAt`, read or unread.
- Credit balance is always derived from `SUM(CreditTransaction.amount)` — never stored as a mutable column.
- `TierLimitConfig` is the single source of truth for tier limits. No hardcoded values in any API route, component, or constants file.
- `FeaturedScoringConfig` is the single source of truth for carousel scoring weights. No hardcoded weight values outside `lib/featured-scoring-weights.ts` (the fallback defaults).
- Profile option constants (`AGE_RANGES`, `GENDERS`, `GENRE_OPTIONS`) are defined once in `lib/user-profile-options.ts` (re-exporting from `lib/age-range.ts`, `lib/gender.ts`, `lib/genre.ts`). Used by onboarding, partner targeting UI, admin test scenario, and validation. Never duplicated.
- `savedByName` is denormalised onto `FeaturedScoringHistory` rows to avoid broken display if an admin account is later deleted.
- Scoring weights are split across two files: `lib/featured-scoring-weights.ts` (client-safe, exports defaults and types) and `lib/featured-scoring-config.ts` (server-only, Prisma, cache). Client components must import from `featured-scoring-weights.ts` only.
- Legal consent is stored as timestamped, versioned fields directly on `User` — not derived from Clerk's compliance checkbox, which can't represent 18+ confirmation or an audit trail of which document version was accepted.
- Strike count is always derived from `COUNT(ModerationLog)` for a user — never a separate mutable counter, mirroring the credit-ledger pattern.
- `ModerationAppeal.moderationLogId` links an appeal to the exact strike that triggered the current suspension (not just "the user's most recent strike"), so admin review and appeal resolution can't drift apart if new strikes land while an appeal is pending.
- `activeSuspensionLogId` on `User` is the anchor pointer for "which suspension cycle is currently open" — cleared on termination, set on suspend, used to build grouped strike history in the admin UI.

---

## Subscription & Quota System

### Overview

Three reader tiers — **Free**, **Standard**, and **Premium** — each with a monthly allowance of Q&A queries and image generations. Limits are enforced in real-time. When the monthly allowance is exhausted, users may draw from a persistent **credit balance** purchased separately. A `BETA_MODE=true` env var bypasses enforcement while still recording usage for monitoring.

### Quota Enforcement Flow

Both `POST /api/imagine` and `POST /api/query` follow the same gate pattern before any AI processing:

1. Auth check via Clerk — user must be signed in and exist in DB.
2. Call `checkUsageLimit(userId, "image" | "query")` from `lib/subscription.ts`.
3. If not allowed → return HTTP 429 with structured body: `{ error: "LIMIT_REACHED", limitType, used, limit, resetDate, creditBalance, creditCost, tier, creditPurchasesEnabled }`.
4. Run AI pipeline (embeddings → vector search → Anthropic/fal → Cloudinary → DB write).
5. Any AI pipeline exception → call `aiFailureResponse()` which logs to `AiServiceFailure` and returns HTTP 502 with `{ error: "AI_FAILURE", message, deducted: false }`. Quota is never deducted on failures.
6. On success → call `consumeUsageAfterSuccess(userId, type, bookId)`.

`Query` and `GeneratedImage` records are only created on success. Failed calls produce no usage records.

### `checkUsageLimit()` Logic

1. Admin role → `allowed: true`, no further checks.
2. `BETA_MODE=true` → force `allowed: true` regardless of counts.
3. Get effective limits via `getEffectiveLimits()`.
4. Resolve billing period via `resolveBillingPeriod()`.
5. Count monthly usage rows since `periodStart`.
6. Get credit balance (`SUM` of `CreditTransaction.amount`).
7. Decision: `limit === null` (unlimited) → allowed; `used < limit` → allowed (quota); `creditBalance >= creditCost` → allowed (credits); otherwise → **not allowed**.

### `getEffectiveLimits()` — Override Layers (in priority order)

1. User's `subscriptionTier` from DB.
2. Active `UserGrant` with `TIER_UPGRADE` — can push effective tier higher.
3. Load `TierLimitConfig` for effective tier (30s cached).
4. Apply limit floors via `applyLimitFloors()` — global decreases can never reduce a user below their floor.
5. Active `UserQuotaOverride` — if present, completely replaces tier-derived limit.
6. `QUERY_BONUS` / `IMAGE_BONUS` grants applied additively if no override.

### Billing Period

Returns `{ periodStart, resetDate }`. If `user.usagePeriodStart` is set (written by Stripe webhook), use it directly. Otherwise calculate from `usagePeriodAnchor` (day of month). Reset date is exactly one calendar month after `periodStart`, with end-of-month clamping.

### Consumption Order

1. Monthly quota first (free to use, resets each cycle).
2. Credit balance second — drawn only after quota reaches zero.

### Credit System

Credits are purchased as one-time packs and never expire. They persist across billing cycles and tier changes. Balance always derived from `SUM(CreditTransaction.amount)`.

**Tier-differentiated pricing:** Premium subscribers pay less per credit than Standard, who pay less than Free. Configured per-pack in `CreditPack.priceFree/priceStandard/pricePremium`.

**Whether Free users can purchase credits** is a per-tier toggle (`TierLimitConfig.creditPurchasesEnabled`).

### Upgrade / Downgrade Behaviour

| Event | Quota Reset? | Credit Balance? | Timing |
|---|---|---|---|
| Upgrade | **Yes** — `usagePeriodStart` set to now | Unchanged | Immediate on Stripe webhook |
| Downgrade | No | Unchanged | Next natural billing cycle end |
| Credit pack purchase | N/A | Increases by pack credits | Immediate on Stripe webhook |
| Admin tier override | No automatic reset | Unchanged | Immediate |
| Admin credit adjustment | N/A | Increases or decreases | Immediate |

### Limit Floors (Grandfathering)

When a user first signs up or upgrades, tier limits are snapshotted onto the `User` row as `queriesLimitFloor`, `imagesLimitFloor`, `queriesUnlimitedFloor`. Global decreases never reduce a user below their floor. Called on: plan selection, checkout completion, subscription update/deletion webhooks.

### Beta Mode

`BETA_MODE=true` bypasses all limit enforcement. Usage is still recorded. The `/account` page shows an amber "Beta mode" banner.

### Stripe Integration (`lib/stripe.ts`)

| Event | Action |
|---|---|
| `checkout.session.completed` | Subscription mode: update user tier, `usagePeriodStart`, Stripe IDs, establish floor. Payment mode: credit user's ledger (idempotent via `stripePaymentIntentId`). |
| `customer.subscription.created` | Sync tier, status, `usagePeriodStart`. Re-establish limit floors if tier changed. |
| `customer.subscription.updated` | Same. On upgrade: set `usagePeriodStart = now()`. On downgrade: set to Stripe's `current_period_start`. |
| `customer.subscription.deleted` | Drop user to `free`, status `cancelled`, clear `stripeSubscriptionId`, establish free-tier floors. |
| `invoice.payment_failed` | Set `subscriptionStatus` to `past_due`. |

### Admin Subscription Controls (`/admin/subscription-settings`)

Three sections: Tier Limits (queries, images, models, credit costs, prices, `creditPurchasesEnabled`), Credit Packs (CRUD), Recent AI Service Failures.

### Per-User Admin Controls (`/admin/users/[userId]`)

Tabbed: Account (usage, floors, partner books), Subscription (tier override, quota overrides, credit adjustment, grants, transaction history), Badges.

### Onboarding Plan Picker (`/onboarding/plan`)

- Four cards: Free, Standard, Premium (Coming Soon), Partner.
- Plan data fetched dynamically via `getPublicTierPlans()`.
- On selection, calls `completePlanStep()` server action: writes `subscriptionTier`, calls `establishLimitFloorsForTier()`, sets bridge cookie, redirects to `/onboarding/preferences`.
- Partner card sets Standard tier and creates a `PartnerRequest` row (deduped). Partner role approval is a separate admin process.
- **Beta:** all accounts use Standard features at no charge. After beta, accounts revert to Free unless upgraded. No card details collected at sign-up.
- **Stripe checkout not yet wired to plan picker** — tier set directly in DB during beta. Must be wired before beta ends.

### Quota Exhausted Modal (`components/subscription/quota-exhausted-modal.tsx`)

Shown on HTTP 429 with `error: "LIMIT_REACHED"`. Displays used vs limit, reset date, credit balance, credit cost. CTAs: upgrade → `/onboarding/plan`, buy credits → `/account#credits` (if `creditPurchasesEnabled`).

### AI Failure Notice (`components/subscription/ai-failure-notice.tsx`)

Shown on HTTP 502 with `error: "AI_FAILURE"`. Failure logged async to `AiServiceFailure`. Quota never deducted.

### Subscription & Quota Key Files

| File | Purpose |
|---|---|
| `lib/subscription.ts` | Core quota logic |
| `lib/credits.ts` | Credit ledger |
| `lib/stripe.ts` | All Stripe interactions |
| `lib/tier-limit-config.ts` | DB-backed tier config, 30s cache |
| `lib/limit-floors.ts` | Grandfathering |
| `lib/ai-service-failure.ts` | `reportAiServiceFailure()`, `aiFailureResponse()` |
| `lib/onboarding-plan-action.ts` | Server action for plan selection |
| `lib/onboarding-cookies.ts` | Plan step bridge cookie helpers |
| `lib/session-profile.ts` | `getOnboardingStage()`, redirect helpers |
| `lib/username.ts` | Username validation regex (`/^[a-zA-Z0-9_]{3,20}$/`) |
| `app/api/imagine/route.ts` | Image generation endpoint with quota gate |
| `app/api/query/route.ts` | Q&A endpoint with quota gate |
| `app/api/onboarding/route.ts` | Profile completion; `409` if username taken |
| `app/api/onboarding/check-username/route.ts` | Username availability check |
| `app/api/webhooks/clerk/route.ts` | Clerk `user.created` → DB provisioning |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook receiver |
| `components/subscription/quota-exhausted-modal.tsx` | Quota exhausted UI |
| `components/subscription/ai-failure-notice.tsx` | AI failure UI |
| `components/subscription/usage-period-panel.tsx` | Usage bars |
| `components/subscription/account-usage-section.tsx` | Account page usage + credit history |
| `app/(reader)/onboarding/plan/plan-client.tsx` | Plan picker UI |
| `app/(reader)/onboarding/preferences/preferences-client.tsx` | Profile preferences UI |
| `app/admin/subscription-settings/subscription-settings-client.tsx` | Admin tier + pack management |
| `app/admin/users/users-client.tsx` | Admin user list |
| `app/admin/users/[userId]/user-detail-client.tsx` | Per-user admin management |

---

## Account Enforcement (Suspension & Appeals)

Three account states track moderation outcomes, separate from `subscriptionTier`/`subscriptionStatus`: `active`, `suspended`, `terminated`. Strikes are recorded individually and permanently; suspensions can be appealed once per cycle; admins resolve appeals from a consolidated panel on the per-user admin page.

### Concepts & terminology

| Term | Meaning |
|---|---|
| **Strike** | A `ModerationLog` row — any moderation incident (admin action, user flag, system auto-suspend, etc.) |
| **Strike count** | `COUNT(ModerationLog)` for the user — not a separate counter field |
| **Suspension** | `accountStatus = suspended` — blocked from app features; may submit one appeal per cycle |
| **Termination** | `accountStatus = terminated` — permanent; credits forfeited; no appeal |
| **Appeal** | User-written explanation, permanently linked to the specific suspension strike (`ModerationAppeal.moderationLogId`) |
| **Suspension cycle** | Strikes leading up to a suspension → suspension action → optional appeal → restore or deny |

**Auto-suspend threshold:** 7 strikes triggers automatic suspension (system log + suspend). Hook exists for future content-moderation pipeline integration (see `Content moderation layer` in Open Items).

### User experience

**When suspended:**
- Redirected to `/account/suspended` when trying to use the app.
- Can still reach: landing page (`/`), `/account/suspended`, login/register, the appeal API.
- Cannot reach: gallery, library, reader, comments, likes, onboarding, partner/admin areas.

**Suspension page (`/account/suspended`):** headline + admin-set `statusReason` if present, full strike history, a "submit an explanation" free-text appeal form (one pending appeal at a time), confirmation after submit, link to the Acceptable Use Policy.

**Appeal rules:**
- Only available while suspended (not terminated).
- One pending appeal at a time.
- Permanently linked to the moderation log anchoring the current suspension (`User.activeSuspensionLogId` → `ModerationAppeal.moderationLogId`).
- Admin receives an email notification with the appeal text, strike history, and a link to the admin user page.

**When terminated:** redirected to `/account/terminated`. No appeal path. Credits forfeited via the ledger. Cannot self-delete the account.

**After restore:** `accountStatus` → `active`, suspension timestamps/reason cleared, pending appeal marked `approved`, full strike history retained for audit.

**After appeal denied:** appeal marked `denied`, account moves to `terminated`, credits forfeited.

### Admin experience

**User list (`/admin/users`):** Status column shows `accountStatus`, not subscription status.

**User detail — consolidated "Account enforcement" panel:**

| Area | Content |
|---|---|
| Summary | Account status, strike count, suspended/terminated timestamps, status reason, pending-appeal badge |
| Strike history | Grouped by suspension cycle, newest first — amber card = suspension, red card = termination, numbered "Suspension #N," strikes leading up, suspension action, nested user explanation |
| Open strikes | Dashed section for strikes accumulated since the last suspension |
| Actions | Suspend, Terminate, Restore active, Approve & restore, Deny appeal |
| Notes | Optional reason / resolution-note field |

**Admin action logic:**

| Button | When shown | Effect |
|---|---|---|
| Suspend | Status not suspended/terminated | Creates a moderation log, sets suspended, stores `activeSuspensionLogId` |
| Terminate | Not terminated | Terminates, forfeits credits, clears the active-suspension pointer |
| Restore active | Suspended, no pending appeal | Restores to active |
| Approve & restore | Pending appeal | Restores + approves the appeal |
| Deny appeal | Pending appeal | Denies the appeal + terminates the account |

"Restore active" is hidden while an appeal is pending — admin must explicitly approve or deny it first.

### Technical architecture

**Enforcement libraries:**

| Module | Responsibility |
|---|---|
| `lib/account-enforcement.ts` | Suspend, terminate, restore, appeal submit, strike threshold, moderation logs |
| `lib/account-status-routing.ts` | Page guards, API guards, redirect paths |
| `lib/moderation-appeal-matching.ts` | Groups appeals under strikes; builds suspension "episodes" for the admin UI |
| `proxy.ts` | Sets `x-pathname` / `x-url` headers consumed by route guards |

**API guards:** suspended/terminated users get HTTP 403 on comment create/edit/delete/flag, gallery like actions, and any other route wired through `accountEnforcementApiGuard` / `accountEnforcementApiGuardForRequest`. Allowed regardless of status: `POST /api/account/appeal`, webhooks.

**Page guards:**

| Layout group | Guard type |
|---|---|
| `(public)`, `(reader)`, `(partner)`, `admin`, onboarding | Restricted — always redirect enforced users |
| `(marketing)`, `account`, `auth` | Allowlist — landing, status pages, login/register |

Guards **fail closed**: if the pathname can't be determined, enforced users are redirected — this is the fix for the earlier gallery-bypass bug.

### Access control matrix

| Resource | Active | Suspended | Terminated |
|---|---|---|---|
| Landing `/` | Yes | Yes | Yes |
| `/register`, `/login` | Yes | Yes | Yes |
| `/account/suspended` | Redirect to library | Yes | Redirect to terminated |
| `/account/terminated` | Redirect | Redirect | Yes |
| Gallery, discover, library, reader | Yes | **No** | **No** |
| Comments, likes | Yes | **No** | **No** |
| Submit appeal | No | **Yes** (once pending) | No |
| Onboarding | Yes | **No** | **No** |
| Admin panel | Admin role | **No** | **No** |
| Self-delete account | Yes | **No** | **No** |

### Key Enforcement Files

| File | Purpose |
|---|---|
| `lib/account-enforcement.ts` | Core enforcement logic |
| `lib/account-status-routing.ts` | Route & API guards |
| `app/account/suspended/page.tsx` | User suspension page |
| `app/account/terminated/page.tsx` | User termination page |
| `app/api/account/appeal/route.ts` | User appeal submission |
| `app/api/admin/users/[userId]/enforcement/route.ts` | Admin enforcement actions |
| `app/admin/users/[userId]/user-detail-client.tsx` | Admin enforcement UI |
| `components/admin/enforcement-strike-history.tsx` | Grouped strike history UI |
| `lib/moderation-appeal-matching.ts` | Appeal ↔ strike linking & episode grouping |
| `proxy.ts` | Middleware + pathname headers |

### Resolved pitfalls (for future reference)

- **Gallery access for suspended users** — fixed via fail-closed route guards + restricted layouts (guards now redirect by default if pathname is unknown, rather than allowing through).
- **Duplicate consent page** — the register path now writes legal consent directly after verification instead of routing through a second agreement page.
- **Appeal ↔ strike ambiguity** — resolved with `moderationLogId` + `activeSuspensionLogId` + the grouped admin UI, so an appeal can never be matched to the wrong strike if new strikes land while it's pending.

---

## Theming

Six dev palettes, toggled via `data-theme` attribute on `<html>`. `DevPaletteSwitcher` writes `data-theme` to `<html>` and persists via cookie (`novelviz_dev_palette`). Server reads this cookie at SSR time in `app/layout.tsx`.

| ID | Name | Accent |
|---|---|---|
| `moonlight-silver` | Moonlight Silver | `#7BA7C9` |
| `candle-light` | Candle Light | `#C49A3C` |
| `deep-ocean` | Deep Ocean | `#3AACB8` |
| `aged-parchment` | Aged Parchment | `#7B4F1E` |
| `forest-dusk` | Forest at Dusk | `#5A9E72` |
| `antiquarian` | Antiquarian | `#B8860B` |

All components reference only CSS custom property tokens — never hardcoded colours. Key tokens: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-hover`, `--border-subtle`, `--border-default`, `--border-strong`, `--accent`, `--accent-dim`, `--accent-glow`, `--highlight`, `--highlight-dim`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`, `--badge-bg`, `--badge-text`, `--shelf-shadow`, `--card-border-hover`, `--glow-color`, `--logo-color`.

---

## Design System — Page Language

All major pages share a consistent visual language.

- Fixed ambient radial glow behind all content: `radial-gradient(ellipse ~55% ~30% at 50% 0%, var(--glow-color), transparent 70%)` via `::before`, `position: fixed`, `z-index: 0`
- Eyebrow label: monospace, 10px, letter-spacing 4px, `var(--text-muted)`, uppercase
- Shimmer headline: gradient 135deg from `--text-primary` to `--highlight` and back, `background-size: 200% auto`, `animation: shimmer 7s linear infinite`
- Entrance animations: `opacity 0→1` + `translateY(20px)→0`, staggered for lists
- Spring-curve lift on hover: `transform: translateY(-7px) scale(1.02)`, `transition: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Section labels: monospace 11px, letter-spacing 4px, flex row with extending gradient line
- `✦` gem dividers between major sections
- Drag-to-scroll on horizontal carousels
- All animations wrapped in `@media (prefers-reduced-motion: reduce)` overrides
- One CSS file per page; JSX prototypes provided to Cursor as reference for visual/structural intent

---

## Discover Page (`/discover`)

`/books` redirects to `/discover`. Nav "Discover" link → `/discover`.

`app/(public)/discover/discover-catalogue-client.tsx` + `discover-redesign.css` + `lib/discover-catalogue.ts`.

Sections: hero, search bar, scrolling marquee, featured carousel (drag-to-scroll, tilt mechanic, active book info panel, Community Visions gallery scoped to selected featured book), genre filter pills, browse grid.

Reader count: `_count.userBooks` where `isActive: true`.

**Featured carousel pool:** Top 20 published books by library popularity (`userBooks` count), scored and ranked for the logged-in user, top 5 returned. Guests see the top 5 by popularity with no scoring applied. There is no admin `isFeatured` toggle on `Book` — the pool is entirely popularity-driven. See Featured Book Scoring section for ranking logic.

---

## Featured Book Scoring

The Discover carousel re-orders its pool of books for each logged-in reader using a personalisation engine. Books that already exist in the reader's library are excluded from the pool before scoring. Guests receive global popularity order.

### Scoring signals

**Genre preferences** are a discovery signal — positive boosts only, never penalties. A reader might enjoy a genre outside their stated preferences.

**Demographic targeting** (age, gender, country) is a business commitment signal from the partner. Match = bonus; mismatch = significant penalty. Books are never fully excluded — a reader outside the demographic target can still see a book if their genre signals are strong enough.

**Library engagement** reflects actual reading behaviour. The library is joined with `ReadingProgress` and chapter counts to determine progress level. Books already in the reader's library are excluded from the carousel before scoring.

**Book recency** boosts new partner uploads. Public domain books receive no recency boost regardless of ingest date.

### Score components (default weights — all admin-configurable)

| Signal | Points |
|---|---|
| Genre preference match | +40 per matching genre |
| Library genre — deep read (>50% chapters complete) | +25 |
| Library genre — in progress (started, ≤50%) | +20 |
| Library genre — recent unread (added within `libraryRecencyDays`, default 90) | +5 |
| Library genre — stale unread (older than `libraryRecencyDays`) | +2 |
| Library genre matches capped at `libraryMatchCap` (default 3) per book | — |
| Book recency — uploaded within 7 days (partner only) | +30 |
| Book recency — 8–30 days | +15 |
| Book recency — 31–90 days | +5 |
| Gender match | +15 |
| Age range match | +12 |
| Country match | +8 |
| Gender mismatch penalty | −40 |
| Age range mismatch penalty | −30 |
| Country mismatch penalty | −15 |

**Demographic rules:**
- A penalty only applies if the partner has set that field (non-empty target array) AND the reader has a value for the field. If either is absent, the signal is 0.
- Empty target array = no restriction for that field.
- Multiple values in a target array (e.g. two age ranges, three countries) — reader matches if their value appears anywhere in the array.

**Effective target genres:** If a book has `featuredTargetGenres` set, those genres plus the book's own genre are used for scoring. If empty, only the book's own genre is used.

**Recency exclusion for public domain:** `getRecencyScore()` returns 0 for any book where `isPublicDomain = true`, regardless of `createdAt`.

### Scoring engine files

| File | Purpose |
|---|---|
| `lib/featured-book-scoring.ts` | Pure scoring functions — no DB calls. Takes `ScoringWeights` param. |
| `lib/featured-scoring-weights.ts` | Client-safe. Exports `DEFAULT_SCORING_WEIGHTS`, `ScoringWeights` type. |
| `lib/featured-scoring-config.ts` | Server-only. Prisma. `getScoringWeights()` with 60s cache, `invalidateScoringWeightsCache()`. |
| `lib/discover-catalogue.ts` | Fetches pool, builds reader profile, calls scoring engine, returns ranked results. |
| `lib/discover-scoring-profile.ts` | Builds `UserScoringProfile` from `UserBook`, `ReadingProgress`, chapter counts. |
| `lib/scoring-radar.ts` | Radar chart normalisation (0–100 scale, 50 = neutral). |

### Partner targeting fields on `Book`

Four `String[]` fields, all defaulting to `[]` (empty = no restriction):

| Field | Meaning |
|---|---|
| `featuredTargetAgeRanges` | AgeRange Prisma enum values |
| `featuredTargetGenders` | Gender Prisma enum values |
| `featuredTargetCountries` | ISO 3166-1 alpha-2 codes |
| `featuredTargetGenres` | BookGenre enum values; empty = book's own genre only |

Partners set these via the Audience Targeting section on their book detail page (`/partner/books/[id]`). The section is hidden for public domain books. Admins can view and edit targeting for all books on `/admin/books/[id]`.

**API:** `PATCH /api/partner/books/[bookId]/targeting` — auth: book owner or admin. Validates all values against known options from `lib/user-profile-options.ts`.

### Profile options — shared constants

`lib/user-profile-options.ts` re-exports from the canonical source files:
- `AGE_RANGES` ← `lib/age-range.ts` (Prisma enum values: `EIGHTEEN_24`, `TWENTY5_34`, etc.)
- `GENDERS` ← `lib/gender.ts` (Prisma `Gender` enum)
- `GENRE_OPTIONS` ← `lib/genre.ts`

These are used identically by: onboarding preferences form, partner targeting UI, admin test scenario builder, and all validation. Never duplicated elsewhere.

### Partner targeting UI (`components/partner/book-audience-targeting.tsx`)

Multi-select pill inputs for age ranges, genders, and additional genres (`MultiSelectPills` component). Searchable scroll-box listbox for countries (`MultiSelectListbox` component — countries list is too long for pills). Auto-saves on change with 800ms debounce. Shows "Saved ✓" on success.

**Targeting preview** (admin only, on `/admin/books/[id]`): `GET /api/admin/books/[bookId]/targeting-preview`. Returns approximate reader counts per signal. Note: the preview uses a strict demographic filter for sizing estimates — it is an **audience-size approximation**, not an exact representation of carousel ranking behaviour (which uses the penalty model, not hard exclusion).

### Admin targeting preview note

The targeting preview counts readers who match strict demographic criteria (OR null-pass-through for unset fields). This differs from live carousel ranking which uses the penalty-based scoring model. Treat preview numbers as "approximate reach," not "exact carousel audience."

---

## Admin Featured Scoring (`/admin/featured-settings`)

Admin nav entry in the flat Admin sidebar list. Allows tuning of all scoring weights, previewing changes with a test scenario, and reviewing the full change history.

### Page sections

**1. Live weights**
Editable numeric inputs for all weight fields, grouped: Genre Signals, Recency Boost, Demographic Match Bonuses, Demographic Mismatch Penalties. Short labels in the form; full names on hover tooltip. Fields that differ from `DEFAULT_SCORING_WEIGHTS` show an accent-coloured left border. `minCarouselSlots` is stored in DB but not exposed in the UI.

**Save button** opens a confirmation modal: "This will update the scoring weights immediately across the entire site. All featured book recommendations will reflect the new weights within 60 seconds." On confirm: upserts `FeaturedScoringConfig`, writes a `FeaturedScoringHistory` row, invalidates the 60s cache, shows inline "Saved ✓".

**2. Radar chart preview**
`RadarChart` from Recharts. Six arms: Genre Preferences, Library Signal, Recency, Gender, Age Range, Country. Two polygons: solid accent = current live weight inputs; dashed grey = `DEFAULT_SCORING_WEIGHTS`. Both use the same test scenario data.

Axes show **0–100 normalised** scores — never raw values. Scale: 50 = neutral (0 raw), 100 = maximum positive for that dimension, 0 = maximum penalty. Raw values shown in an adjacent table. The chart updates in real time as live weight inputs or test scenario fields change.

On large screens the chart and raw score table are side by side.

**3. Test scenario builder**
Two cards: Test Reader and Test Book. All fields pull from shared option constants. Countries use `MultiSelectListbox`; other multi-select fields use local `PillToggle`. Test Reader library entries each have: genre, progress level ("Not started" / "In progress" / "More than halfway"), and add recency ("Within last 90 days" / "Older than 90 days"). Up to 6 library entries.

The test scenario contains **reader and book data only** — no separate weight inputs. Weights always come from Section 1 live weight inputs.

**Snapshot banner:** When test fields are populated via a history Restore, a banner shows: "Loaded from snapshot: [date] — saved by [name]." Editing any live weight field or test field clears the banner.

**Publish button** — same confirmation modal and POST as the Save button. Publishes the current live weight inputs (not the test scenario data itself).

**4. History calendar**
`react-calendar` component, styled with CSS custom properties. Days with history entries show a small accent dot via `tileContent`. Month navigation fetches `GET /api/admin/featured-scoring/history?year=YYYY&month=M`.

Detail panel to the right: click a date to see changes. If multiple changes on one day, a dropdown above the detail lets the admin select which snapshot to view. Detail shows: saved at, saved by, diff table (only changed fields, previous → new, amber highlight), full weight table (changed fields normal, unchanged muted), Restore button.

**Restore flow:**
1. Clicked → weight values populate the live weight inputs in Section 1.
2. Snapshot banner appears in the test scenario section.
3. Radar chart updates immediately.
4. Page scrolls to Section 1.
5. Admin reviews, edits further if needed, then clicks Save.
6. Save writes a new history row — the restore itself is not recorded as a history event.

---

## Gallery

### Surfaces

- `/gallery` — main page: book-grouped horizontal rows, genre pill filtering, FROM YOUR LIBRARY + DISCOVER sections
- `/gallery/[bookId]` — full image grid for one book

### Architecture

`page.tsx` is a **thin server component** — it resolves viewer identity, loads session context (role, `globalSpoilerProtection`, `genrePreferences`, active library book IDs, per-book spoiler settings), and passes props to `GalleryClient`. No images are loaded server-side.

All gallery image data is fetched client-side via `GET /api/gallery`. Row building, spoiler gating, discovery filtering, and comment counts all happen in `lib/gallery-page-data.ts` inside that API handler.

### `/gallery` — Layout

```
Header (eyebrow, title, subtitle, badge legend + GallerySpoilerSelect for members)
Guest banner (guests only — sign-in prompt)
Genre pills (client-side filter; "All" default)
FROM YOUR LIBRARY — one BookRow per library book with visible images
DISCOVER — up to 5 BookRows for non-library books, invitation card last in each strip
Empty states
```

**Removed:** masonry grids, LATEST FEATURED carousel, guest library blur teaser. There is no longer a separate FEATURED section on the main gallery — `isFeatured` flag still exists on images (gold star badge) but the main gallery is not filtered by it.

Each **BookRow** has:
- A fixed left anchor (book cover thumbnail, title, author, genre pill)
- A horizontal scrollable image strip (drag-to-scroll via `hooks/use-horizontal-drag-scroll.ts`)
- In DISCOVER rows only: an **invitation card** as the last item in the strip

### `GET /api/gallery` — Response Shape

```typescript
{
  libraryRows: BookGalleryRow[]
  discoveryRows: BookGalleryRow[]
  discoveryMode: "community" | "cover-fallback"
  userGenrePreferences: string[]
  libraryMeta: {
    hasLibraryBooks: boolean
    hasVisibleLibraryImages: boolean
  }
}

type BookGalleryRow = {
  bookId, title, author, coverImageUrl, genre
  totalPublicImages: number        // ALL public images for the book (used for invitation card)
  images: GalleryImageCard[]
}

type GalleryImageCard = {
  id, imageUrl, chapterNumberAtTime
  userId, username
  likeCount, commentCount          // commentCount via viewerVisibleCommentCountByImageIds
  isLikedByCurrentUser
  isLocked, lockKind               // library rows only; discovery rows always unlocked
  isFeatured                       // gold star badge
  isOwnImage
}
```

`GET /api/gallery?session=true` returns all library images with `isLocked: false` (session browsing override).

### FROM YOUR LIBRARY — Data Logic

- Books where viewer has `UserBook.isActive: true` on published, non-deleted books
- All `isPublic: true` images returned with `isLocked` / `lockKind` flags
- **Unstarted preview:** no `ReadingProgress` row → images at or below `ceil(totalChapters × 0.10)` are unlocked; images beyond that threshold are locked (`lockKind: "unstarted"`)
- **Reading in progress:** images with `chapterNumberAtTime <= currentChapter` unlocked; beyond → locked (`lockKind: "chapter"`)
- Own images are never locked
- Admins and `?session=true`: all library images returned with `isLocked: false`
- Row order: `ReadingProgress.updatedAt desc`, then `UserBook.addedAt desc`
- Books with zero visible images are omitted

### DISCOVER — Data Logic

- Published, non-deleted books **not** in viewer's active library
- **Spoiler threshold per book:** `ceil(totalChapters × 0.10)` — only images where `chapterNumberAtTime <= threshold` are included
- Computed server-side in `lib/gallery-page-data.ts` — never on the client
- Images beyond the threshold are **not returned at all** — no lock state, simply absent
- Books with zero qualifying images are excluded entirely (no empty rows)
- `totalPublicImages`: real total of all public images for the book — used for invitation card copy ("X more images inside" where X = `totalPublicImages - images.length`)
- Sort: genre preference overlap first, then qualifying image count desc
- Cap: **5 rows**
- Guests: same logic, no library to exclude, order by qualifying image count desc

### Spoiler Protection Hierarchy

Three layers, resolved in `lib/gallery-spoiler.ts`:

**1. Global** — `User.globalSpoilerProtection` (bool, default true).

**2. Per-book** — `UserBook.spoilerProtection` (INHERIT / PROTECTED / UNLOCKED).

**3. Effective gate mode:**

| `UserBook.spoilerProtection` | Result |
|---|---|
| `UNLOCKED` | `show_all` — never chapter-gate |
| `PROTECTED` | `gate_chapters` — always chapter-gate |
| `INHERIT` | `gate_chapters` if `globalSpoilerProtection === true`, else `show_all` |

**4. Session override** — `GallerySpoilerSelect` dropdown sets `gallerySessionRevealAll`; client refetches `GET /api/gallery?session=true`, returning all library images unlocked. Resets on page mount. Likes while active send `sessionBrowsingUnlockedBookIds: [bookId]` in the POST body.

**Lock kinds:**

| `lockKind` | Meaning |
|---|---|
| `none` | Visible |
| `chapter` | Reader started but hasn't reached this chapter |
| `unstarted` | No reading progress; image beyond 10% early-preview threshold |

(`guest_blur` removed — old guest blur teaser no longer exists.)

**Discovery rows have no lock state** — the threshold is enforced server-side before images are returned. Cards always render unlocked.

### Padlock Badge Colours (library rows, unlocked cards only)

| Colour | Condition |
|---|---|
| Aqua | Viewer's own image |
| Green | Chapter gate active; image within reading progress |
| Yellow | Spoiler protection effectively off |
| Red | Book set to `UNLOCKED` while account global protection is on |

`isFeatured` images show a **gold star** badge (not a padlock).

### Invitation Card (DISCOVER rows only, always last in strip)

Same dimensions as an image card. Background: book cover blurred and darkened. Shows "X more images inside" count. CTA:
- Logged in: `POST /api/library/[bookId]` with `{ spoilerProtection: "PROTECTED" }`, then refetch gallery — book moves to FROM YOUR LIBRARY
- Guest: redirects to `/login`

### Discovery Preview Likes

For books **not** in the viewer's library, likes are allowed on images at or below the discovery threshold (`ceil(totalChapters × 0.10)`) without library membership or reading progress. Implemented via `isDiscoveryPreviewLikeAllowed` in `lib/gallery-image-lock-server.ts` — must match discovery row builder threshold math exactly.

### Genre Filtering

Client-side only — no refetch. Pills built from genres present in `libraryRows` + `discoveryRows` plus `userGenrePreferences`. "All" pill default. Selecting a genre hides/shows rows by `row.genre`. Uses `formatGenre` / `GENRE_LABELS`.

### Image Popup Modal

Rendered via `GalleryImageModalShell` (portaled to `document.body` — required because `.gallery-root` uses `isolation: isolate`).

**Unlocked:** full image, prompt, like/share, comments sidebar, link to per-book gallery, admin featured toggle.

**Locked:** blurred image, no prompt, no comments; CTAs: unlock book, add to library, continue reading.

Modal carousel spans all unlocked images across library + discovery rows. Locked images open a single-card fallback but are not in the swipe sequence.

### `/gallery/[bookId]`

Dedicated grid of all public images for one book. Images fetched client-side via `GET /api/gallery/book/[bookId]`. Lock behaviour differs from main gallery:

- Guest: all images `isLocked: false`
- Admin or `?session=true`: all images unlocked
- Member: `isGalleryImageChapterLocked` per image — **no** 10% unstarted preview (all community images locked if no reading progress)

`GallerySpoilerSelect` shown when book is in viewer's library; toggling refetches with `?session=true`.

### Viewer Matrix

| Viewer | FROM YOUR LIBRARY | DISCOVER | Spoiler on library images |
|---|---|---|---|
| Guest | Hidden | Up to 5 rows; invitation → login | N/A |
| Member, empty library | Empty state CTA | Discovery rows | N/A |
| Member, with library | One row per book with public images; locked cards blurred | Non-library books only | `memberLock` + 10% unstarted preview |
| Member, session reveal | All library images unlocked (API refetch) | Unchanged | Off for display |
| Admin | All unlocked | Preview images (threshold still applied) | Never locked |

### Gallery API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/gallery` | Library + discovery rows for main gallery |
| GET | `/api/gallery?session=true` | Same, library images all unlocked |
| GET | `/api/gallery/book/[bookId]` | All public images for one book with lock flags |
| GET | `/api/gallery/book/[bookId]?session=true` | Same, all unlocked for authenticated user |
| GET | `/api/gallery/book/[bookId]?featured=true&limit=N` | Featured subset (used by discover carousel) |
| POST | `/api/gallery/[imageId]/like` | Like; re-validates chapter lock server-side |
| POST | `/api/library/[bookId]` | Add book to library (from invitation card / locked modal) |
| PATCH | `/api/user-books/[bookId]/spoiler-protection` | Per-book spoiler override |

### Key Gallery Files

| File | Purpose |
|---|---|
| `app/(public)/gallery/page.tsx` | Session props only — no image loading |
| `app/(public)/gallery/gallery-client.tsx` | Main gallery UI, fetch, modal, genre filter |
| `app/api/gallery/route.ts` | Main gallery API entry |
| `lib/gallery-page-data.ts` | Viewer context, `buildLibraryRows`, `buildDiscoveryRows`, `memberLock` |
| `lib/gallery-types.ts` | Shared TypeScript types (`BookGalleryRow`, `GalleryImageCard`, etc.) |
| `lib/gallery-spoiler.ts` | Gate mode resolution, lock predicates |
| `lib/gallery-image-lock-server.ts` | Like API lock check + `isDiscoveryPreviewLikeAllowed` |
| `lib/gallery-card-spoiler-badge.ts` | Corner padlock badge colours |
| `lib/gallery-comment-counts.ts` | `viewerVisibleCommentCountByImageIds` |
| `lib/featured-image-selection.ts` | Featured image selection (used by discover carousel, not main gallery) |
| `components/gallery/gallery-book-row.tsx` | BookRow — anchor + scrollable strip + invitation card |
| `components/gallery/gallery-genre-pills.tsx` | Genre filter pills |
| `components/gallery/gallery-spoiler-select.tsx` | Session reveal dropdown |
| `components/gallery/gallery-image-modal-shell.tsx` | Modal portal (body-level) |
| `components/gallery/modal-image-swipe-view.tsx` | Modal image pane + lock shade |
| `components/gallery/gallery-image-comments.tsx` | Comments section in modal |
| `components/gallery/spoiler-review-gallery-modal.tsx` | Admin spoiler review modal |
| `hooks/use-horizontal-drag-scroll.ts` | Pointer-capture drag scroll for image strips |

---

## Comments

Comments on public generated images, in the image popup modal (unlocked state only).

### Comment Status Meanings

- **`VISIBLE`** — Normal public comment.
- **`HIDDEN_SPOILER`** — Scan or author self-flag. If `spoilerModerationAt` is null, pending admin review.
- **`PENDING_CONTENT_REVIEW`** — Reader-flagged for inappropriate content.
- **`DELETED`** — Soft delete. Never returned from listing API.

### Core Visibility Logic — `getCommentViewerPresentation`

Single source of truth in `lib/comment-viewer-presentation.ts` (re-exported as `lib/comment-visibility.ts`).

**Key rules:**
- `PENDING_CONTENT_REVIEW`: only admin, session override, or comment author get `listVisible`.
- `HIDDEN_SPOILER`: admins + session override always see full content. Author sees content with `showAuthorReview` until admin sets `spoilerModerationAt`.
- Spoiler gate math: `isBehindSpoilerCommentGate` in `lib/gallery-spoiler.ts`.

### Automated Spoiler Scan

`lib/comment-scan.ts`. New comments created as `VISIBLE`. Scan calls Claude with JSON-shaped prompt. Spoiler → `HIDDEN_SPOILER`, `spoilerGateChapter` set, `COMMENT_HIDDEN_PENDING` notification to author. Fail-open: scan failure leaves comment VISIBLE.

### Comment API Routes

- `GET /api/comments?imageId=…` — non-deleted comments filtered by `listVisible`
- `POST /api/comments` — create, triggers spoiler scan
- `PATCH /api/comments/[commentId]` — reword, reinstate, confirm_spoiler, moderate_content
- `DELETE /api/comments/[commentId]` — soft-delete
- `POST /api/comments/[commentId]/flag` — flag for content review

### Key Comment Files

| File | Purpose |
|---|---|
| `lib/comment-viewer-presentation.ts` | Core per-viewer visibility logic |
| `lib/comment-scan.ts` | Async Claude spoiler scan |
| `lib/gallery-spoiler.ts` | Gate helpers |
| `lib/notifications.ts` | `createNotification()` |
| `components/gallery/gallery-image-comments.tsx` | Comment section UI |

---

## Notifications

Bell icon in nav. Polls `GET /api/notifications` every 60 seconds. Dropdown on click; marks all read via `PATCH /api/notifications/read-all`. Up to 15 most recent (last 30 days).

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/notifications` | Last 30 days, limit 15, + unread count |
| PATCH | `/api/notifications/read-all` | Mark all read |
| PATCH | `/api/notifications/[id]/read` | Mark single read |

---

## Gutenberg Import Pipeline

Four npm scripts:

| Command | Script | Purpose |
|---|---|---|
| `npm run gutenberg-fetch` | `scripts/gutenberg-fetch.ts` | Build/refresh discovery queue |
| `npm run gutenberg-ingest` | `scripts/gutenberg-ingest.ts` | EPUB ingest + OL metadata + covers + embeddings |
| `npm run gutenberg-enrich` | `scripts/gutenberg-enrich.ts` | Backfill for books ingested before unified ingest |
| `npm run gutenberg-park-deferred` | `scripts/gutenberg-park-deferred.ts` | Move blocked titles to deferred file |

**Queue files (gitignored):** `scripts/gutenberg-queue.json`, `scripts/gutenberg-queue-deferred.json`.

### Canonical Description Helper

Always use `resolveGutenbergCatalogDescription(gutenbergId, summaries)` from `lib/gutenberg-page-summary.ts`. Priority: Gutendex summary → scrape gutenberg.org → OL/EPUB/subject fallback.

### Discovery (`gutenberg-fetch`)

Calls Gutendex for up to 1000 popular English titles. `pickEpubUrl()` prefers no-images EPUB. Hard-reject and soft-review filters applied. Flags: `--delta`, `--verbose`.

### Review (`/admin/gutenberg-import`)

Tabs: Accepted, Needs review, Rejected, Deferred, Flagged. Ingest only processes `approved: true` rows not in deferred file. As of v11, this page is reached via a single **Import queue** sidebar link — the tabs are in-page only and no longer have separate top-level sidebar entries (previously Deferred/Needs review/Accepted/Publish were each their own sidebar link under a dedicated "Gutenberg pipeline" group; `lib/gutenberg-admin-nav.ts` has been removed).

### Ingest (`gutenberg-ingest`)

Per approved book: skip if already in DB → no EPUB → park deferred → download (120s timeout) → >4.5MB → park deferred → resolve enrichment → parse chapters → chunk → embed → status `pending_review`. `--resume` retries failed books.

### Backfill (`gutenberg-enrich`)

```bash
npm run gutenberg-enrich -- --gutenberg-summaries --dry-run
npm run gutenberg-enrich -- --gutenberg-summaries --status pending_review
```

### Gutenberg Key Files

| Path | Role |
|---|---|
| `scripts/gutenberg-fetch.ts` | Discovery |
| `scripts/gutenberg-ingest.ts` | Full ingest |
| `lib/gutenberg-page-summary.ts` | Canonical description resolver |
| `lib/open-library-cover.ts` | Unified metadata + cover resolution |
| `lib/book-rejection-notes.ts` | Prepend rejection reason to `internalNotes` |
| `app/admin/gutenberg-import/` | Review + deferred UI |
| `app/api/admin/gutenberg-queue/route.ts` | Queue API |

---

## For Review Queue (Admin Dashboard)

Both Gutenberg ingest and partner/admin EPUB uploads land in `pending_review`. A book is in the queue when `Book.status === 'pending_review'` and `Book.deletedAt === null`.

**Approve** → status from `listingPreferenceAfterReview` (`published` or `unlisted`). Sends `BOOK_APPROVED` notification.

**Reject** → requires ≥20 char reason. Sets `rejected`, prepends block to `internalNotes`, sends `BOOK_REJECTED` notification.

**Delete** → soft-delete.

### Admin Book Detail (`/admin/books/[id]`)

Moderation actions + Chapter Manager (edit titles, merge, delete, **bulk delete by title phrase** — absorbed the standalone Bulk Chapter Delete admin page in v11) + Internal notes + Status dropdown + **Audience Targeting panel** (read/write, all books including public domain) + Targeting preview.

---

## Admin Sidebar (flat list, v11)

As of v11, all admin-only nav lives as one flat list under the dashboard's existing "Admin" heading — no "Helpers" wrapper label, no duplicate top-nav dropdown. The only nesting is a collapsed **Developer tools** sub-group for the two dev/reference-only pages. See also the "Admin sidebar redesign (v11)" note under **Dashboard** above for the history of what this replaced.

**Dashboard tabs** (open inside `/dashboard`, defined in `lib/dashboard-tab.ts`):

| Title | Tab | Purpose |
|---|---|---|
| For Review | `for-review` | Queue of `pending_review` books. Approve/reject/delete, open full editor, search. |
| Manage Featured Images | `feature-approvals` | Curate Discover "Community Visions" images; approve/reject partner feature requests. |
| Comment Moderation | `comment-moderation` | **Merged in v11** (was Spoiler Comments + Flagged Comments). All / Spoiler / Flagged filter toggle, defaults to All. Spoiler and Flagged rows render in separate headed sub-sections under "All" — available actions differ (Reinstate/Confirm spoiler/Delete vs. Restore/Remove). Sidebar badge = sum of both; per-filter counts shown next to each toggle option. |
| All Books | `all-books` | Searchable catalogue, filterable by status. |
| All Users | `all-users` | Embedded directory; links to `/admin/users` for full management. |
| Admin Stats | `admin-stats` | KPIs, 30-day activity, AI cost table, vendor billing, top book requests summary. |

**Standalone page links** (plain links to their route, listed directly below the tabs in the same flat sidebar list — no grouping label):

| Title | Route | Purpose |
|---|---|---|
| Book requests | `/admin/requests` | Reader demand signals from Discover (incl. guest submissions). Moved out of its old orphaned top-level spot in v11. |
| Cover refresh | `/admin/cover-refresh` | Lists `pending_review` books with generic PG cover; scans OL for better cover. |
| Cover AI settings | `/admin/cover-ai-settings` | Edit default prompt blocks and allowed fal.ai models for the publisher cover generator. |
| Subscription & credits | `/admin/subscription-settings` | Per-tier limits, credit costs, credit pack pricing, recent AI service failures. |
| Featured scoring | `/admin/featured-settings` | Tune carousel scoring weights, test with radar chart, review history. |
| Import queue | `/admin/gutenberg-import` | Gutenberg discovery queue + ingest approvals. In-page tabs: Accepted, Needs review, Rejected, Deferred, Flagged. |

**Developer tools** (collapsed sub-group — the only nesting in the Admin list):

| Title | Route | Purpose |
|---|---|---|
| Data flows | `/admin/data-flows` | Reference diagrams for ingest, image gen, Q&A, comments, Gutenberg bulk-import. |
| T2I tester | `/admin/t2i-tester` | Compare fal.ai text-to-image models side by side with preset prompts. |

**Removed in v11:**
- **Bulk chapter delete** (`/admin/chapters/bulk-delete`) — deleted entirely; equivalent bulk-delete-by-title-phrase functionality now lives inside the per-book Chapter Manager on `/admin/books/[id]`.
- **Top-nav Helpers dropdown** (`components/nav-client.tsx`) — removed; sidebar is the only home for these links now.
- **Gutenberg pipeline sidebar group** (Deferred / Needs review / Accepted / Publish as separate links) — collapsed into the single Import queue link above; those views are now in-page tabs only. `lib/gutenberg-admin-nav.ts` deleted.

### Admin Sidebar Key Files

| File | Purpose |
|---|---|
| `lib/dashboard-tab.ts` | Dashboard tab definitions, incl. merged `comment-moderation` |
| `lib/dashboard-data.ts` | Badge counts, including summed Comment Moderation count |
| `lib/admin-helpers-nav.ts` | Flat Admin list + Developer tools sub-group definition |
| `components/admin/admin-helpers-nav.tsx` | Renders the flat list + sub-group, badge counts |
| `components/nav-client.tsx` | Top nav — Helpers dropdown removed here in v11 |

---

## Book Ingestion Pipeline

1. Upload EPUB via admin/partner page
2. Cover extracted → Cloudinary (`novelviz/covers/[bookId]`)
3. Genre detected via GPT-4o-mini (max 20 tokens)
4. Chapters parsed from `toc.ncx` navMap; Gutenberg boilerplate filtered
5. Each chapter chunked (~500 tokens, ~50 overlap)
6. Chunks embedded via `text-embedding-3-small`, stored via raw SQL pgvector insert
7. Book status → `ready_for_review`
8. Open Library enrichment runs as non-blocking post-ingestion step

Post-ingestion: admin can edit chapters via Chapter Manager. Finalise re-chunks and re-embeds.

**EPUB size limit:** >4.5MB hits Vercel payload limit. Use no-images Gutenberg EPUBs.

---

## AI Systems

### Chapter Gating — 4 Enforcement Layers

1. **DB query:** `WHERE ch."sequenceNumber" <= ${currentChapterNumber}`
2. **Q&A system prompt:** Claude answers only from provided excerpts
3. **Image enrichment prompt:** Claude focuses only on PRIMARY SUBJECT from excerpts
4. **DB snapshot:** `chapterNumberAtTime` int on Query + GeneratedImage

### Anthropic Claude

Client in `lib/anthropic.ts`. Model from `ANTHROPIC_MODEL` env var. Falls through candidates on `not_found_error`.

```typescript
const DEFAULT_ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-sonnet-4-20250514"]
```

#### Q&A — `POST /api/query`

Embed question → retrieve top 5 chunks (chapter-gated) → Claude → save to Query. `max_tokens: 1000`.

#### Image Generation — `POST /api/imagine`

Two Claude calls + one fal.ai call + one Cloudinary upload.

- **Call 1 — Subject Extraction** (`max_tokens: 50`): primary visual subject.
- **Dual vector search:** embeds both `userPrompt` and `extractedSubject`, 5 chunks each, merged + deduplicated to max 8.
- **Call 2 — Prompt Enrichment** (`max_tokens: 300`): detailed image gen prompt.

### Image Generation Models

**Library Imagine (`POST /api/imagine`):**

| Model | Endpoint | Price | Who |
|---|---|---|---|
| xai/grok-imagine-image | `xai/grok-imagine-image` | $0.02/image | Readers, partners, admins (default) |
| Seedream v4.5 | `bytedance/seedream/v4.5/text-to-image` | $0.04/image | Admin only |
| flux/schnell | `fal-ai/flux/schnell` | ~$0.003/image | Admin only (dev/test) |

All schnell-generated images must be deleted before production launch.

**Cover AI (`POST /api/books/[id]/cover-ai/generate`):**

| Model | Key | Who |
|---|---|---|
| flux/schnell | `flux-schnell` | Admin only |
| xai/grok-imagine-image | `grok` | Admin only |
| Seedream v4.5 | `seedream-v45` | Partners + Admin |

### AI Costs (2026)

| Operation | Cost |
|---|---|
| OpenAI text-embedding-3-small / 1M tokens | $0.02 |
| OpenAI gpt-4o-mini input / 1M tokens | $0.15 |
| OpenAI gpt-4o-mini output / 1M tokens | $0.60 |
| Claude Sonnet input / 1M tokens | $3.00 |
| Claude Sonnet output / 1M tokens | $15.00 |
| xai/grok-imagine-image per image | $0.02 |
| Seedream v4.5 per image | $0.04 |
| fal.ai flux/schnell per image | ~$0.003 |
| Single image generation — all steps (grok) | ~$0.025 |
| Single Q&A query | ~$0.009 |
| Novel ingestion (~180 chunks) | ~$0.05 |
| Comment spoiler scan (per comment) | ~$0.002 |

### AI Error Handling

- OpenAI embed fail → 500
- Anthropic 404 → fall through to next candidate. All fail → 502 via `aiFailureResponse()`.
- fal.ai fail → 502 via `aiFailureResponse()`
- Cloudinary upload fail → 502. Never saves fal URL to DB.
- Comment scan fail → logged, comment stays VISIBLE (fail open)
- All AI failures logged async to `AiServiceFailure`. Quota never deducted on failures.

### Key AI Files

| File | Purpose |
|---|---|
| `lib/anthropic.ts` | Anthropic client singleton |
| `lib/ingestion.ts` | OpenAI embeddings, chunking, EPUB parsing, genre detection |
| `lib/fal.ts` | fal.ai client (Library Imagine) |
| `lib/cover-ai-fal.ts` | fal.ai client for Cover AI |
| `lib/cover-ai-prompt.ts` | `assembleCoverAiPrompt` |
| `lib/cover-ai-settings.ts` | `CoverAiAdminSettings` singleton |
| `lib/cover-ai-access.ts` | Access + quota exemption |
| `lib/comment-scan.ts` | Async Claude comment spoiler scan |
| `lib/costs.ts` | Cost constants + estimation helpers |
| `components/ui/image-generation-loader.tsx` | Infinity-sparks loader (Cover AI + Library Imagine) |
| `components/cover-ai/cover-ai-modal.tsx` | Cover AI modal UI |
| `app/api/query/route.ts` | Q&A endpoint |
| `app/api/imagine/route.ts` | Library image generation endpoint |
| `app/api/books/[id]/cover-ai/` | Cover AI generate/commit/discard/config routes |
| `app/admin/cover-ai-settings/` | Admin UI for base prompt, templates, model list |

---

## Featured Image System

`GeneratedImage.isFeatured` controls the Discover page "Community Visions" strip (scoped to the selected featured book). Separate from the Gallery FEATURED carousel (likes/recency, no `isFeatured` filter).

**Admin:** direct toggle via `PATCH /api/admin/images/[imageId]/feature`.

**Partner:** requests via Images tab → `POST /api/feature-requests`. Admin approve/reject sends notification.

---

## Cover AI

Partners and admins generate portrait (3:4) cover candidates, preview up to five drafts in a carousel modal, then commit one as `Book.coverImageUrl`.

### Five-Preview Carousel

Loading slides do not count toward the 5-preview cap — only `ready` slides count. Quota increments on successful Cloudinary upload, not on generate click. Committing destroys all drafts (chosen + others). Closing without committing triggers best-effort discard.

### Partner Quota

`coverGenAttemptsGranted` (default 5) and `coverGenAttemptsConsumed` on `Book`. Admins are always quota-exempt. Admin can reset via `resetCoverGenQuota: true` on `PATCH /api/admin/books/[id]`.

### Cloudinary Folders

| Folder | Contents |
|---|---|
| `novelviz/covers/[bookId]` | Official committed book covers |
| `novelviz/cover-drafts/[bookId]/[uuid]` | Temporary Cover AI draft previews |
| `novelviz/gallery/[imageId]` | Library Imagine generated images |

---

## My Library (`/library`)

"Currently reading" experience. CSS: `library-redesign.css`.

Three sections: page header, open book animation + contextual panel, bookshelf + stats strip.

**Open book animation:** pure CSS 3D. Phases: `closed` → `opening` (80ms) → `open` (600ms) → content fades in (800ms).

**Active book:** defaults to most recent `ReadingProgress` update; falls back to first by `UserBook.createdAt`.

**Contextual panel:** Continue reading card, Q&A prompt card, Image nudge card.

**Bookshelf:** tilt mechanic (±1.5deg), spring hover, mini progress bar, active book lifted, `✦` dot indicator.

**Stats strip:** Books in Library, Total Questions Asked, Total Images Created.

---

## Dashboard

Role-aware left-sidebar shell. CSS: `dashboard-redesign.css`.

**Layout:** sticky top bar (logo / dev role switcher / avatar), 220px left sidebar, main content area.

**Nav by role:**
- Reader: Overview · Currently Reading · My Images · Q&A History · Account
- Partner (+ divider): My Books · Analytics · Feature Requests
- Admin (+ divider, flat list, no "Helpers" wrapper): For Review · Manage Featured Images · Comment Moderation · All Books · All Users · Admin Stats · Book requests · Cover refresh · Cover AI settings · Subscription & credits · Featured scoring · Import queue · Developer tools (expandable: Data flows, T2I tester)

**Admin sidebar redesign (v11):** Previously the admin sidebar split into four scattered groups — a 7-tab "Admin Settings" block, a duplicated "Helpers" list (shown in both the top nav dropdown and the sidebar), a separate 5-link Gutenberg pipeline group, and one orphaned "Book requests" link. This was flattened into a single Admin list:
- Top-nav "Helpers" dropdown removed entirely (`components/nav-client.tsx`) — sidebar is now the only place these links live.
- **Spoiler Comments** and **Flagged Comments** merged into one **Comment Moderation** tab with an All / Spoiler / Flagged filter toggle (defaults to All). Spoiler and Flagged rows render in separate headed sub-sections even under "All", since available actions differ (Reinstate/Confirm spoiler/Delete vs. Restore/Remove). Sidebar badge = sum of both queues; each filter option shows its own count.
- The 5-link Gutenberg pipeline group (Import queue, Deferred, Needs review, Accepted, Publish) collapsed into a single **Import queue** sidebar link → `/admin/gutenberg-import`. Deferred/Needs review/Accepted/Flagged/Rejected remain reachable as in-page tabs on that page. "Publish" was dropped as a separate link since it only pointed at `/admin/books` (already reachable via All Books).
- **Bulk chapter delete** removed entirely — equivalent functionality now lives in the per-book Chapter Manager on `/admin/books/[id]`.
- **Book requests** (`/admin/requests`) moved out of its orphaned top-level spot into the flat Admin list.
- **Data flows** and **T2I tester** — both dev/reference tools rather than daily admin tasks — moved into a collapsed **Developer tools** sub-group, the only remaining nesting in the Admin list.
- Source: `lib/admin-helpers-nav.ts` (renders the flat list + Developer tools sub-group), `lib/dashboard-tab.ts` (tab definitions, now includes merged `comment-moderation`), `components/admin/admin-helpers-nav.tsx` (renders the structure, preserves badge-count display). `lib/gutenberg-admin-nav.ts` deleted.

**Status badge colours:**
```
published:      #5A9E72  (green)
pending_review: #C49A3C  (amber)
draft:          rgba(255,255,255,0.3)
rejected:       #EF4444  (red)
unlisted:       rgba(255,255,255,0.3)
```

---

## Stats & Analytics

Reader count per book: `_count.userBooks` where `isActive: true`.

**Partner stats page** (`/partner/books/[id]/stats`): reader count, total queries, total images KPI cards; chapter engagement heatmap; demographics.

**Admin Stats:** KPI grid, 30-day activity sparkline, AI cost table (operation / count / est. cost, including comment scans), vendor billing cards.

**Token fields on Query:** `embeddingTokens`, `promptTokens`, `completionTokens`
**Token fields on GeneratedImage:** `embeddingTokens`, `promptTokens`, `completionTokens`, `subjectTokens`
**Token fields on Book:** `ingestionPromptTokens`, `ingestionCompletionTokens`

---

## UI Components

| Component | Path | Purpose |
|---|---|---|
| `MultiSelectPills` | `components/ui/multi-select-pills.tsx` | Multi-select pill toggles. Used for age ranges, genders, genres in partner targeting and admin test scenario. |
| `MultiSelectListbox` | `components/ui/multi-select-listbox.tsx` | Searchable scroll-box with checkboxes. Used for country targeting (list too long for pills). |
| `ImageGenerationLoader` | `components/ui/image-generation-loader.tsx` | Infinity-sparks loader. Used in Cover AI modal and Library Imagine. |

---

## Email

NovelViz uses **Resend** for all outbound application email. There are no user-facing transactional emails from app code — only admin operational alerts. Auth emails (verification, magic links) are Clerk's responsibility; billing emails (receipts, subscription lifecycle) are Stripe's.

### Architecture

All Resend traffic goes through `lib/admin-email.ts`. Do not import or call Resend directly anywhere else.

| Layer | Technology | Purpose |
|---|---|---|
| App → admin inbox | Resend via `lib/admin-email.ts` | Plain-text operational alerts |
| Auth emails | Clerk | Verification, password reset, magic links |
| Billing emails | Stripe | Receipts, subscription lifecycle |
| User alerts | In-app notifications (`lib/notifications.ts`) | Bell icon in nav — not email |

### `lib/admin-email.ts` — Public API

| Export | Purpose |
|---|---|
| `sendAdminEmail(input)` | Fire-and-forget send; never throws to callers |
| `AdminEmailCategory` | Subject prefix tag |
| `buildAdminEmailSubject(category, detail)` | `[CATEGORY] - detail` (detail truncated to 120 chars) |
| `buildAdminEmailBody(bodyLines)` | `Label: value` lines joined with `\n` |
| `getAppBaseUrl()` | Base URL for link construction |
| `absoluteAppUrl(path)` | Absolute URL for admin links in email bodies |
| `CONTACT_SUBJECT_LABELS` | Contact form enum → readable label |

**Input shape:**
```ts
sendAdminEmail({
  category: AdminEmailCategory.CONTACT,
  subjectDetail: "General enquiry - Jane Doe",
  replyTo: "user@example.com",  // optional — only CONTACT uses this today
  bodyLines: [
    { label: "Name", value: "Jane Doe" },
    { label: "Message", value: "..." },
  ],
});
```

**Format:** Plain text only — no HTML templates. Subject: `[CATEGORY] - {subjectDetail}`. To: `ADMIN_NOTIFICATION_EMAIL`. From: `EMAIL_FROM` (verified Resend sender). Reply-To: set when provided (contact form sets visitor email).

**Runtime behaviour:**
- Missing `ADMIN_NOTIFICATION_EMAIL` or `EMAIL_FROM` → logs `[admin-email] skipped`, returns.
- Missing `RESEND_API_KEY` → logs `[admin-email] would send` with full payload (no API call). Useful in local dev.
- Resend error → logs `[admin-email] send failed`; caller unaffected.
- **Always fire-and-forget** — do not `await`. DB writes happen before `sendAdminEmail` in all call sites. HTTP responses return success even if email fails.

### Admin Email Categories and Triggers

| Category | Trigger | Caller |
|---|---|---|
| `CONTACT` | Public contact form submit | `POST /api/contact` |
| `BOOK-REQUEST` | Reader requests a title be added | `POST /api/requests` |
| `PARTNER-REQUEST` | Reader applies for partner access (dashboard) | `POST /api/partner-requests` |
| `PARTNER-REQUEST` | User selects partner interest on plan step | `completePlanStep()` in `lib/onboarding-plan-action.ts` |
| `FEATURE-REQUEST` | Partner/admin requests gallery image featuring | `POST /api/feature-requests` |
| `SPOILER-FLAG` | AI comment scan flags possible spoiler | `scanCommentForSpoilers()` in `lib/comment-scan.ts` |
| `COMMENT-FLAG` | Reader reports inappropriate comment | `POST /api/comments/[commentId]/flag` |
| `COVER-AI-REQUEST` | Partner exhausts cover gen allowance | `POST /api/books/[id]/cover-ai/request-more` |

**Notes:**
- `CONTACT`: no DB write — email only. Sets `replyTo` to submitter's email.
- `PARTNER-REQUEST` from onboarding: deduped — only one onboarding marker row per user. Publisher name stored as `[Onboarding] Partner access requested`.
- `SPOILER-FLAG`: also fires `createNotification` to comment author (`COMMENT_HIDDEN_PENDING`).
- `COMMENT-FLAG`: also fires `createNotification` to author (`COMMENT_REPORTED_TO_AUTHOR`) and `notifyUsersWithRole(admin, COMMENT_FLAGGED_FOR_MODERATION)`.
- AI service failures are **not** emailed — stored in `AiServiceFailure` and shown in admin dashboard only.

### Adding a New Admin Email

1. Add a constant to `AdminEmailCategory` in `lib/admin-email.ts` if no existing category fits.
2. After successful DB write, call `sendAdminEmail(...)` — do not await.
3. Import only from `lib/admin-email.ts` — never import `resend` directly.
4. If users also need to know, add `createNotification` separately.

### Key Email Files

| File | Purpose |
|---|---|
| `lib/admin-email.ts` | Resend singleton, categories, send helper |
| `lib/notifications.ts` | In-app bell notifications (not email) |
| `lib/comment-scan.ts` | Spoiler scan → admin email + author notification |
| `lib/onboarding-plan-action.ts` | Onboarding partner interest email |
| `app/api/contact/route.ts` | Contact form |
| `app/api/requests/route.ts` | Book requests |
| `app/api/partner-requests/route.ts` | Partner applications |
| `app/api/feature-requests/route.ts` | Feature image requests |
| `app/api/comments/[commentId]/flag/route.ts` | Comment content flags |
| `app/api/books/[id]/cover-ai/request-more/route.ts` | Cover AI quota requests |

### Local Dev Testing

Omit `RESEND_API_KEY` (or leave `ADMIN_NOTIFICATION_EMAIL`/`EMAIL_FROM` unset) and trigger any form. The API returns `{ success: true }` and the terminal logs `[admin-email] would send` or `[admin-email] skipped`. No emails are sent.

---


## Open Items

### Pre-launch tweaks (in progress)

- Landing page — add 3-column "how it works" section under hero title
- Partner UX — make "upload new book" more discoverable
- Dashboard — ✅ DONE (admin sidebar flattened in v11: removed duplicate top-nav Helpers dropdown, merged Spoiler/Flagged Comments into one Comment Moderation tab, collapsed 5-link Gutenberg pipeline group into one Import queue link, removed Bulk chapter delete page in favour of per-book Chapter Manager, grouped Data flows/T2I tester under a Developer tools sub-group)
- Library "currently reading" sort order — needs investigation
- Gallery redesign — ✅ DONE (book-grouped rows, genre filtering, DISCOVER section with 10% chapter spoiler threshold)
- Sign-up flow — ✅ DONE in v12 (replaced checkbox-gated Clerk embedded widget with a custom NovelViz-branded email/password form; legal consent now written directly to DB after inline verification, with cookie/manual fallback for edge cases only)
- Account suspension / strike / appeal system — ✅ DONE in v12 (three account states, immutable strike log, one-appeal-per-cycle linked to the specific triggering strike, consolidated admin enforcement panel, fail-closed route guards)
- Credit pack purchase UI for readers — backend fully supports it; in-app storefront minimal
- Pre-beta-end billing ramp: wire Stripe checkout to plan picker before beta ends. No card collection during beta itself.
- **Stripe webhook URL:** When wiring Stripe, register the webhook as `https://www.novelviz.com/api/webhooks/stripe` (not apex) — same 307 redirect issue that affected Clerk applies here too.

### V2 / Planned

- Full notification inbox page
- Threaded comment replies
- Entity extraction per chapter → improve image gen accuracy + character consistency
- Batch Gutenberg ingestion via background queue (QStash or Trigger.dev)
- Retailer affiliate links + click tracking
- Email: Resend integration **done** (admin operational alerts). Loops (mailing list) still pending. User-facing transactional emails (welcome, comment approved, etc.) not yet implemented.
- Non-chapter content handling (poems, prologues, interludes currently dropped)
- Add-to-library spoiler preference checkbox
- Neon consumption API integration in admin stats (after Launch plan upgrade)
- Open Library cover image fallback (`cover_i` field captured, not yet used)
- Batch Open Library enrichment for existing books
- Comment scan token tracking in admin stats cost table
- Partner portal at `/partner/dashboard`
- Cover AI: AI-assisted prompt generation
- Cover AI: model choice for partners (currently fixed to Seedream v4.5)
- FAQ page entries explaining upgrade/downgrade quota reset behaviour and billing policies
- Content moderation layer (pre-send filtering — currently AI model-level filtering only)
- Native mobile app (React Native; PWA as interim)
- Featured scoring: `minCarouselSlots` field exists in DB but not yet wired to any runtime logic — reserved for future use

### Known Edge Cases

- Gallery like API does not replicate the library 10% unstarted preview — a library image visible via unstarted preview may not be likable until reading progress is saved or session reveal is active. Discovery preview likes use a separate exception (`isDiscoveryPreviewLikeAllowed`).
- `discoveryMode: "cover-fallback"` in gallery API response indicates discovery rows are showing books without community images (cover-only fallback) — handle in UI if needed.
- EPUB >4.5MB: Vercel payload limit. Fix: direct browser→Cloudinary upload.
- Non-chapter content (poems, interludes, prologues) dropped during EPUB parsing.
- Gutenberg `dc:date` = digitisation date — Open Library enrichment fixes for new ingestions.
- Open Library may occasionally match wrong edition for common titles.
- Comment scan is fail-open: scan failure leaves comment VISIBLE.
- `PENDING_CONTENT_REVIEW` comments invisible to all readers except author and admins — slow admin review means legitimate comment appears missing.
- Cover AI draft cleanup is best-effort — orphaned drafts in `novelviz/cover-drafts/` possible if modal closed mid-generate.
- Credit pack reader storefront is minimal — users reach credit purchase via Stripe portal.
- Stripe checkout not yet connected to onboarding plan picker — must be wired before beta ends.
- Post-beta revert: all beta accounts drop to Free tier. Users must actively upgrade.
- Targeting preview on admin book detail uses strict demographic filter, not the live penalty model — treat as audience sizing only.
- `FeaturedScoringConfig` missing row is handled by fallback to `DEFAULT_SCORING_WEIGHTS` — system never breaks on a missing config row.
- Client components must import scoring weights from `lib/featured-scoring-weights.ts` only — `lib/featured-scoring-config.ts` is server-only (Prisma).
- Acceptable Use Policy is drafted but not yet published — mandatory CSAM reporting obligations under Canadian law require legal review first. The suspension page links to the AUP, so this should be resolved before public launch.
- Suspended users receive no in-app notification when an appeal is resolved — they find out by signing in again and being routed to `/library` (restored) or `/account/terminated` (denied).

---

## Dev Workflow

- Claude writes all Cursor prompts → Chris pastes into Cursor Composer
- Plan mode before Agent mode for multi-file tasks
- Commit after each session before switching machines (laptop ↔ desktop)
- `CURSOR.md` + `NOVELVIZ_REFERENCE_v12.md` maintained as persistent context
- `dev` branch → staging; merge to `main` → production
- Domain: novelviz.com — DNS on Namecheap → Vercel. Do not delete DNS records.
- **gitignore `!` prefix is a footgun** — never use near env files. `.env.example` was tracked, credentials exposed, all keys rotated. Always audit gitignore rules.
- JSX prototypes provided to Cursor as reference files — Cursor reads for visual/structural intent and wires to real data, does not use mock data
- Queue files (`gutenberg-queue.json`, `gutenberg-queue-deferred.json`) are gitignored — copy between machines to share approvals and deferred lists
- General questions unrelated to the codebase asked in plain chats (not project chats) to avoid token overhead from project file injection
- **Apex → www redirect (307):** Vercel serves the site on `www.novelviz.com` and 307-redirects the apex. Always use `https://www.novelviz.com` in any third-party webhook or callback URL (Clerk, Stripe, etc). POST bodies are dropped on 307 redirects — failures are silent and hard to diagnose.
- Reference doc is now `NOVELVIZ_REFERENCE_v12.md` — update `CURSOR.md` to point at the new version
