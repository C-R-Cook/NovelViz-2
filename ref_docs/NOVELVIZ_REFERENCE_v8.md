# NovelViz Reference
**Version 8** — Updated June 2026

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

NovelViz uses Clerk for accounts. App DB (`User` row keyed by `clerkId`) is synced via webhook and a server-side fallback on first request.

**Production routes:**
- `/register` — Clerk sign-up (legacy `/sign-up` redirects here)
- `/login` — Clerk sign-in (legacy `/sign-in` redirects here)
- `/auth/after` — post-Clerk landing page; provisions DB user and routes to correct next step
- `/onboarding/plan` — plan selection (step 3 of onboarding)
- `/onboarding/preferences` — profile setup (step 4 of onboarding)
- `/onboarding` — router only (no UI); reads session and redirects to correct step

**New user flow:** `/register` → Clerk → `/auth/after` → `/onboarding/plan` → `/onboarding/preferences` → `/library`
**Returning user flow:** `/login` → Clerk → `/auth/after` → `/library` (or back to incomplete onboarding step if not yet complete)

**Onboarding completion rule:** a user is considered onboarded when they have **both** a `username` and **at least one `genrePreference`** on their `User` record.

**Onboarding stage logic** (`lib/session-profile.ts` → `getOnboardingStage()`):

| Stage | Condition |
|---|---|
| `plan` | No genre prefs **and** no username **and** plan cookie not set |
| `preferences` | No genre prefs **but** username exists **or** plan cookie is set |
| `complete` | Username set **and** at least one genre preference exists |

**Plan step bridge cookie** (`onboarding_plan_done=1`, `lib/onboarding-cookies.ts`): set by `completePlanStep()`, cleared after preferences submit. Max age 24h, SameSite Lax. Required because username doesn't exist yet when the plan step completes — without it, a user with no username would loop back to `/onboarding/plan`.

**`/auth/after` provisioning screen:** Shows "Setting up your account…" with the infinity loader while polling for DB user existence (webhook latency / cold start). Polls via page reload up to ~14 seconds; shows a sign-in retry link if provisioning times out.

**DB user creation:**
- Primary: Clerk webhook `user.created` → `POST /api/webhooks/clerk`
- Fallback: `ensureDbUserForClerk()` on first `getCurrentUser()` / `ensureCurrentUser()` call if webhook missed
- New users get: email + name from Clerk, default `usagePeriodAnchor` from sign-up day (capped at 28), default role `reader`

**Access control:**
- Clerk middleware (`proxy.ts`) protects `/onboarding(.*)`, `/library(.*)`, `/account(.*)` etc.
- Reader layout (`app/(reader)/layout.tsx`) requires Clerk session + resolved `User` — otherwise redirect to `/auth/after`
- Reader app shell (`app/(reader)/(app)/layout.tsx`) additionally requires completed onboarding; incomplete users redirected via `getOnboardingRedirectUrl()`
- Dev only: `dev_user_id` cookie bypasses Clerk in middleware. Does not exist in production.

**Legacy / edge cases:**
- User has username but no genres (legacy account) → preferences page in genres-only mode (username field read-only)
- Signed-in user opens `/register` → redirect to post-auth destination
- Already-complete user hits any `/onboarding` URL → redirect to `/library`

**Deploy checklist:** Clerk production instance, webhook at `/api/webhooks/clerk` with `user.created` event, `CLERK_WEBHOOK_SECRET` in env. Clerk global URLs set in `app/layout.tsx`: `signInUrl="/login"`, `signUpUrl="/register"`.

---

## Route Structure

```
app/
├── (public)/         → /discover (/books redirects here), /gallery, /gallery/[bookId],
│                        /faq, /contact, /privacy, /terms
├── (reader)/
│   ├── onboarding/   → /onboarding (router), /onboarding/plan, /onboarding/preferences
│   └── (app)/        → /library, /dashboard, /reader/[bookId], /account
├── (partner)/        → /partner/books/new, /partner/books/[id], /partner/books/[id]/stats
├── admin/            → /admin/books, /admin/books/[id], /admin/requests, /admin/stats,
│                        /admin/gutenberg-import, /admin/cover-refresh,
│                        /admin/subscription-settings, /admin/featured-settings,
│                        /admin/users, /admin/users/[userId]
├── auth/after/       → /auth/after (post-Clerk provisioning + routing)
├── register/         → /register (Clerk sign-up)
├── dev/              → /dev/onboarding-preview (404 in production)
└── api/
    ├── query/
    ├── imagine/
    ├── onboarding/           → profile save + username check
    ├── billing/
    │   ├── checkout/subscription/
    │   ├── checkout/credits/
    │   └── portal/
    ├── webhooks/clerk/
    ├── webhooks/stripe/
    ├── account/
    │   ├── usage/
    │   └── credits/
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
```

---

## Roles

- `reader` — browse, library, Q&A, image gen, gallery, dashboard
- `partner` — reader + upload books, manage catalogue, view own book stats, request image featuring
- `admin` — everything + moderation, all stats, approve/reject submissions, approve/reject feature requests, Helpers
- Hierarchy: reader ⊂ partner ⊂ admin

**Role vs. Tier distinction:** `UserRole` (reader / partner / admin) controls platform access type. `SubscriptionTier` (free / standard / premium) controls AI action allowances. These are independent. Admins bypass quota checks entirely regardless of tier.

---

## Schema

**User:** `clerkId`, `username` (public), `name`, `email`, `role` (UserRole), `gender`, `ageRange`, `country`, `genrePreferences`, `subscribedToMailingList`, `globalSpoilerProtection` (bool, default true), `subscriptionTier` (SubscriptionTier), `subscriptionStatus` (SubscriptionStatus), `stripeCustomerId`, `stripeSubscriptionId`, `usagePeriodAnchor` (day-of-month int), `usagePeriodStart` (DateTime — set by Stripe webhook), `queriesLimitFloor` (Int?), `imagesLimitFloor` (Int?), `queriesUnlimitedFloor` (Bool?)

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

Admin nav entry under Helpers. Allows tuning of all scoring weights, previewing changes with a test scenario, and reviewing the full change history.

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

- `/gallery` — main page: FROM YOUR LIBRARY + FEATURED
- `/gallery/[bookId]` — full image grid for one book

### `/gallery` — Current Data Logic

**FROM YOUR LIBRARY:** mixed latest images from all library books, per-book + global gating applied.

**FEATURED:** `GeneratedImage` where `isPublic === true`, ordered by `likeCount desc` then `createdAt desc`, top 20.

**Guest view:** FEATURED shown fully. FROM YOUR LIBRARY shows ~5 blurred decorative images as CTA.

### Spoiler Protection Hierarchy

**1. Global** — `User.globalSpoilerProtection` (bool, default true).

**2. Per-book** — `UserBook.spoilerProtection` (INHERIT / PROTECTED / UNLOCKED, default INHERIT).

**3. Session override** — `/gallery/[bookId]` only. `sessionStorage['novelviz_session_unlocks']`. Amber banner shown while active.

**Resolution order:**
1. Not logged in → show everything
2. Session override active → show everything
3. UserBook === UNLOCKED → show everything
4. UserBook === PROTECTED → gate to progress
5. UserBook === INHERIT + global false → show everything
6. UserBook === INHERIT + global true → gate to progress
7. Book not in library → show everything

**Gating:** locked if `image.chapterNumberAtTime > ReadingProgress.currentChapter`

### `/gallery/[bookId]`

Header: cover, title, author, public image count, SpoilerToggle (cycles INHERIT→PROTECTED→UNLOCKED→INHERIT), session buttons, amber banner. Grid: locked images show blur + lock icon + "Chapter X". Click → popup modal.

### Padlock Icons (visible cards only, logged-in users only)

| Icon | Colour | Condition |
|---|---|---|
| 🔓 Aqua `#00BCD4` | Your image | `image.userId === currentUserId` |
| 🔓 Red `#EF4444` | Per-book UNLOCKED, global PROTECTED | UserBook=UNLOCKED + global=true |
| 🔓 Green `#22C55E` | Safe — within reading progress | chapter ≤ current, protection active |
| 🔓 Yellow `#EAB308` | Global protection off | global=false |

### Image Popup Modal

**Unlocked:** full image, book/author, "Generated at Chapter X", prompt, like button (hidden for owner), "Your image" badge, "Make public" (owner + private), SpoilerToggle in footer, "Reuse settings" (owner only), comments section.

**Locked:** blurred image + lock icon, chapter gap message, unlock or add-to-library CTAs, no comments.

### Gallery API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/gallery/book/[bookId]` | All images for book, spoiler-gating server-side |
| GET | `/api/gallery/book/[bookId]?featured=true&limit=N` | `isFeatured && isPublic` only, no spoiler gating |
| PATCH | `/api/user/spoiler-protection` | Update global setting |
| PATCH | `/api/user-books/[bookId]/spoiler-protection` | Update per-book setting |

### Key Gallery Components

| Component | Path |
|---|---|
| `SpoilerToggle` | `components/gallery/spoiler-toggle.tsx` |
| `GalleryImageComments` | `components/gallery/gallery-image-comments.tsx` |
| `SpoilerReviewGalleryModal` | `components/gallery/spoiler-review-gallery-modal.tsx` |
| `gallery-client.tsx` | `app/(public)/gallery/` |
| `gallery-book-client.tsx` | `app/(public)/gallery/[bookId]/` |

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

Tabs: Accepted, Needs review, Rejected, Deferred, Flagged. Ingest only processes `approved: true` rows not in deferred file.

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

Moderation actions + Chapter Manager (edit titles, merge, delete) + Internal notes + Status dropdown + **Audience Targeting panel** (read/write, all books including public domain) + Targeting preview.

---

## Admin Helpers

| Helper | URL | Purpose |
|---|---|---|
| Cover refresh | `/admin/cover-refresh` | Lists pending_review books with generic PG cover; scans OL for better cover |
| Bulk chapter delete | (in Helpers) | Search phrase, select books, delete matching chapter titles |
| Featured scoring | `/admin/featured-settings` | Tune carousel scoring weights, test with radar chart, review history |

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
- Admin (+ divider): For Review · Spoiler Comments · Flagged Comments · Feature Approvals · Helpers · All Books · All Users · Admin Stats · Subscription Settings · Featured Scoring

**Admin comment queues in sidebar:** Spoiler Comments (`HIDDEN_SPOILER`, `spoilerModerationAt` null), Flagged Comments (`PENDING_CONTENT_REVIEW`). Both with badge counts.

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
- Dashboard — reduce redundancy, generally confusing to navigate
- Library "currently reading" sort order — needs investigation
- Gallery — surface images related to user genre interests
- Credit pack purchase UI for readers — backend fully supports it; in-app storefront minimal
- Pre-beta-end billing ramp: wire Stripe checkout to plan picker before beta ends. No card collection during beta itself.

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

---

## Dev Workflow

- Claude writes all Cursor prompts → Chris pastes into Cursor Composer
- Plan mode before Agent mode for multi-file tasks
- Commit after each session before switching machines (laptop ↔ desktop)
- `CURSOR.md` + `NOVELVIZ_REFERENCE_v7.md` maintained as persistent context
- `dev` branch → staging; merge to `main` → production
- Domain: novelviz.com — DNS on Namecheap → Vercel. Do not delete DNS records.
- **gitignore `!` prefix is a footgun** — never use near env files. `.env.example` was tracked, credentials exposed, all keys rotated. Always audit gitignore rules.
- JSX prototypes provided to Cursor as reference files — Cursor reads for visual/structural intent and wires to real data, does not use mock data
- Queue files (`gutenberg-queue.json`, `gutenberg-queue-deferred.json`) are gitignored — copy between machines to share approvals and deferred lists
- General questions unrelated to the codebase asked in plain chats (not project chats) to avoid token overhead from project file injection
