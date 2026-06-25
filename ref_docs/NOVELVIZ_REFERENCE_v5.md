# NovelViz Reference
**Version 5** — Updated June 2026

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
| Prisma client | Generated to `app/generated/prisma`, imported via `@db` alias. Seed uses `tsx` not ts-node. |
| Images | Cloudinary — covers at `novelviz/covers/[bookId]`, gallery images at `novelviz/gallery/[imageId]`, 2:3 crop fit for covers. |
| AI — embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| AI — Q&A + enrichment | Anthropic Claude (`ANTHROPIC_MODEL` env var) |
| AI — image gen | fal.ai — role-gated model selection |
| Hosting | Vercel. `dev` branch = staging, `main` = production. |
| Domain | novelviz.com (Namecheap DNS → Vercel) |

**Key libraries:** `@anthropic-ai/sdk`, `openai`, `@fal-ai/client`, `cloudinary`, `@clerk/nextjs`, `@prisma/adapter-neon`, `jszip`, `fast-xml-parser`, `react-markdown`, `recharts`

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
- `/login` — Clerk sign-in
- `/register` — Clerk sign-up
- `/sign-in`, `/sign-up` — legacy redirects
- `/auth/after` — post-Clerk redirect: `/onboarding` if no username, else `/library`
- `/onboarding` — username + profile (required before reader app)

**New user flow:** `/register` → Clerk → `/auth/after` → `/onboarding/plan` → `/onboarding/preferences` → `/library`
**Returning user flow:** `/login` → Clerk → `/auth/after` → `/library`

**DB user creation:**
- Primary: Clerk webhook `user.created` → `POST /api/webhooks/clerk`
- Fallback: `ensureDbUserForClerk()` on first `getCurrentUser()` if webhook missed

**Dev impersonation (no Clerk):** Sign out of Clerk, pick a user in the Dev user control (bottom-right). Middleware allows access when `dev_user_id` cookie is set (non-production only). `getCurrentUser()` — Clerk session wins if present, otherwise dev cookie.

**Deploy checklist:** Clerk production instance, webhook endpoint at `/api/webhooks/clerk` with `user.created`, `CLERK_WEBHOOK_SECRET` in env.

---

## Route Structure

```
app/
├── (public)/         → /books, /gallery, /gallery/[bookId], /faq, /contact, /privacy, /terms
├── (reader)/(app)/   → /library, /dashboard, /reader/[bookId], /account, /onboarding
├── (partner)/        → /partner/books/new, /partner/books/[id], /partner/books/[id]/stats
├── admin/            → /admin/books, /admin/books/[id], /admin/requests, /admin/stats,
│                        /admin/gutenberg-import, /admin/cover-refresh,
│                        /admin/subscription-settings, /admin/users, /admin/users/[userId]
└── api/
    ├── query/
    ├── imagine/
    ├── billing/
    │   ├── checkout/subscription/
    │   ├── checkout/credits/
    │   └── portal/
    ├── webhooks/stripe/
    ├── account/
    │   ├── usage/
    │   └── credits/
    └── admin/
        ├── subscription-config/tiers/
        ├── subscription-config/credit-packs/[id]/
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

**Book:** `title`, `author`, `description`, `genre` (BookGenre), `status` (BookStatus), `ownerId`, `coverImageUrl`, `isPublicDomain`, `deletedAt` (soft delete), `publishedYear` (Int?), `openLibraryKey` (String?), `gutenbergId` (Int? @unique), `ingestionPromptTokens` (Int?), `ingestionCompletionTokens` (Int?), `listingPreferenceAfterReview` (String? — `"published"` or `"unlisted"`, set by partner on submit, cleared after admin action), `rejectionReason` (String?, set on reject), `internalNotes` (String?, rejection reason prepended as block by `lib/book-rejection-notes.ts`)

**Chapter:** `bookId`, `sequenceNumber`, `title`, `rawText`

**Chunk:** `chapterId`, `bookId` (denormalised for pgvector perf), `sequenceNumber`, `content` (~500 tokens), `embedding` (1536-dim vector)

**UserBook:** User↔Book join. `spoilerProtection` (SpoilerProtection enum, default INHERIT), `isActive` (bool)

**ReadingProgress:** `userId`, `bookId`, `currentChapter`

**Query:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `questionText`, `responseText`, `promptTokens`, `completionTokens`, `embeddingTokens`

**GeneratedImage:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `userPrompt`, `fullPrompt`, `imageUrl` (always Cloudinary URL), `isPublic` (default false), `isFeatured` (default false), `model`, `promptTokens`, `completionTokens`, `embeddingTokens`, `subjectTokens`

**TierLimitConfig:** One row per tier. `tier` (SubscriptionTier), `queriesPerMonth` (Int? — null = unlimited), `imagesPerMonth` (Int? — null = unlimited), `allowedModels` (String[]), `creditPurchasesEnabled` (Bool), `creditCostQuery` (Int), `creditCostImage` (Int), `displayPriceMonthly` (String), `stripePriceId` (String?). Admin-editable via `/admin/subscription-settings`. 30-second in-memory cache in `lib/tier-limit-config.ts`. **Single source of truth for all tier limits — no hardcoded values anywhere.**

**CreditPack:** Admin-configured one-time purchase packs. `name`, `credits` (Int), `active` (Bool), `priceFree` (Int — cents), `priceStandard` (Int — cents), `pricePremium` (Int — cents), `stripePriceId` (String?), `sortOrder` (Int). Tier-differentiated pricing: Advanced subscribers pay less per credit than Standard, who pay less than Free.

**CreditTransaction:** Immutable credit ledger. `userId`, `amount` (Int — positive = add, negative = spend), `reason` (CreditTransactionReason), `bookId` (nullable), `creditPackId` (nullable), `stripePaymentIntentId` (nullable — for idempotency), `grantedBy` (nullable), `note` (String?). **Current balance = `SUM(amount)` for a given user.** Never use a mutable balance field.

**UserQuotaOverride:** Per-user limit override, takes precedence over global tier config. `userId`, `queriesLimit` (Int?), `imagesLimit` (Int?), `expiresAt` (DateTime?), `reason`, `grantedBy`.

**UserGrant:** Bonus grants. `userId`, `grantType` (GrantType), `source` (GrantSource), `tierValue` (SubscriptionTier?), `bonusAmount` (Int?), `usedAmount` (Int), `expiresAt` (DateTime?). Used for tier upgrades and additive query/image bonuses.

**AiServiceFailure:** Failure log. `userId`, `route`, `bookId` (nullable), `errorSummary` (String, max 2000 chars). Indexed by `createdAt`. Quota is never deducted on logged failures.

**FeatureRequest:** `imageId`, `requestedBy`, `status` (FeatureRequestStatus), `reviewedBy` (nullable), `createdAt`, `updatedAt`. `@@unique([imageId])` — one active request per image at a time.

**BookRequest:** user-submitted catalogue requests

**Like:** `@@unique([userId, imageId])`

**Comment:** `id`, `imageId`, `userId`, `content`, `status` (CommentStatus, default VISIBLE), `spoilerGateChapter` (Int?), `spoilerModerationAt` (DateTime?), `spoilerScanDebug` (Json?), `createdAt`, `updatedAt`. Relations: GeneratedImage (cascade delete), User (cascade delete).

**Notification:** `id`, `userId`, `type` (NotificationType), `message`, `link`, `read` (bool, default false), `createdAt`. Relation: User (cascade delete). Retained for 30 days.

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
- Comments are not gated by chapter number structurally — spoiler detection is semantic, handled by async Claude scan. `spoilerGateChapter` captures the chapter boundary at scan time.
- `spoilerModerationAt` distinguishes "scan flagged, pending admin review" from "admin confirmed spoiler, permanently gated".
- Notifications retained 30 days from `createdAt`, read or unread.
- Credit balance is always derived from `SUM(CreditTransaction.amount)` — never stored as a mutable column. Provides full audit trail.
- `TierLimitConfig` is the single source of truth for tier limits. No hardcoded values in any API route, component, or constants file.

---

## Subscription & Quota System

### Overview

Three reader tiers — **Free**, **Standard**, and **Premium** — each with a monthly allowance of Q&A queries and image generations. Limits are enforced in real-time; users cannot exceed their quota on an honor system. When the monthly allowance is exhausted, users may draw from a persistent **credit balance** purchased separately. A `BETA_MODE=true` env var bypasses enforcement while still recording usage for monitoring.

### Quota Enforcement Flow

Both `POST /api/imagine` and `POST /api/query` follow the same gate pattern before any AI processing:

1. Auth check via Clerk — user must be signed in and exist in DB.
2. Call `checkUsageLimit(userId, "image" | "query")` from `lib/subscription.ts`.
3. If not allowed → return HTTP 429 with structured body: `{ error: "LIMIT_REACHED", limitType, used, limit, resetDate, creditBalance, creditCost, tier, creditPurchasesEnabled }`.
4. Run AI pipeline (embeddings → vector search → Anthropic/fal → Cloudinary → DB write).
5. Any AI pipeline exception → call `aiFailureResponse()` which logs to `AiServiceFailure` and returns HTTP 502 with `{ error: "AI_FAILURE", message, deducted: false }`. Quota is never deducted on failures.
6. On success → call `consumeUsageAfterSuccess(userId, type, bookId)`. If monthly quota now exceeded (user is in credit territory), deduct via credit ledger.

`Query` and `GeneratedImage` records are only created on success. Failed calls produce no usage records. Monthly quota is counted by summing rows since `periodStart`.

### `checkUsageLimit()` Logic (`lib/subscription.ts`)

1. Admin role → `allowed: true`, no further checks.
2. `BETA_MODE=true` → force `allowed: true` regardless of counts.
3. Get effective limits via `getEffectiveLimits()`.
4. Resolve billing period via `resolveBillingPeriod()`.
5. Count monthly usage (`Query` or `GeneratedImage` rows since `periodStart`).
6. Get credit balance (`SUM` of `CreditTransaction.amount`).
7. Decision: `limit === null` (unlimited) → allowed; `used < limit` → allowed (quota); `creditBalance >= creditCost` → allowed (will use credits); otherwise → **not allowed**.

### `getEffectiveLimits()` — Override Layers (in priority order)

1. User's `subscriptionTier` from DB.
2. Active `UserGrant` with `TIER_UPGRADE` — can push effective tier higher.
3. Load `TierLimitConfig` for effective tier (30s cached).
4. Apply limit floors via `applyLimitFloors()` — global decreases can never reduce a user below the limit they had when they first subscribed (grandfathering protection).
5. Active `UserQuotaOverride` — if present, completely replaces tier-derived limit.
6. `QUERY_BONUS` / `IMAGE_BONUS` grants applied additively if no override.

### Billing Period (`resolveBillingPeriod()`)

Returns `{ periodStart, resetDate }`. If `user.usagePeriodStart` is set (written by Stripe webhook), use it directly. Otherwise calculate from `usagePeriodAnchor` (day of month). Reset date is exactly one calendar month after `periodStart`, with end-of-month clamping. Stripe handles edge cases like signup on the 31st.

### Consumption Order

1. Monthly quota first (free to use, resets each cycle).
2. Credit balance second — drawn only after quota reaches zero.

### Credit System

Credits are purchased as one-time packs and never expire. They persist across billing cycles and tier changes. The balance is always `SUM(CreditTransaction.amount)` — never a mutable column.

**Tier-differentiated pricing:** Premium subscribers pay less per credit than Standard, who pay less than Free. This is configured per-pack in `CreditPack.priceFree/priceStandard/pricePremium`.

**Whether Free users can purchase credits** is a per-tier toggle (`TierLimitConfig.creditPurchasesEnabled`), configurable by admin. Do not assume it is on or off for any tier.

**`lib/credits.ts` functions:**
- `getCreditBalance(userId)` — `SUM(amount)` from `CreditTransaction`
- `getCreditTransactions(userId, options)` — paginated history
- `addCreditTransaction(params)` — inserts ledger row (purchases and spends)
- `spendCreditsIfNeeded(params)` — checks if monthly used > limit; if so deducts via ledger

### Upgrade / Downgrade Behaviour

| Event | Quota Reset? | Credit Balance? | Timing |
|---|---|---|---|
| Upgrade (tier rank increases) | **Yes** — `usagePeriodStart` set to now; user gets full new-tier allowance immediately | Unchanged | Immediate on Stripe `customer.subscription.updated` webhook |
| Downgrade (tier rank decreases) | No | Unchanged | Takes effect at next natural billing cycle end (Stripe `proration_behavior`) |
| Credit pack purchase | N/A | Increases by pack credits | Immediate on Stripe `checkout.session.completed` webhook |
| Admin tier override | No automatic reset | Unchanged | Immediate (bypasses Stripe) |
| Admin credit adjustment | N/A | Increases or decreases | Immediate |

The upgrade reset is a deliberate promotional gesture — upgrading users get a fresh full allowance immediately. The downgrade deferral closes the upgrade/downgrade abuse loop (no way to farm resets by cycling tiers within a single billing period).

### Limit Floors (Grandfathering) — `lib/limit-floors.ts`

When a user first signs up or upgrades, their current tier limits are snapshotted onto the `User` row as `queriesLimitFloor`, `imagesLimitFloor`, and `queriesUnlimitedFloor`. If an admin later lowers global limits, existing users cannot be reduced below their floor. If an admin raises global limits, all users benefit. Called on: plan selection, subscription checkout completion, subscription update webhook, subscription deletion webhook.

### Beta Mode

`BETA_MODE=true` (env var) bypasses all limit enforcement. `checkUsageLimit()` always returns `allowed: true`. All usage is still recorded normally so data exists when beta ends. The usage panel on `/account` shows an amber "Beta mode" banner. The admin user detail page shows a similar notice.

### Stripe Integration (`lib/stripe.ts`)

**Webhook events handled:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Subscription mode: update user tier, `usagePeriodStart`, Stripe IDs, establish floor. Payment mode: credit user's ledger with purchased pack credits (idempotent via `stripePaymentIntentId`). |
| `customer.subscription.created` | Sync tier, status, `usagePeriodStart`. Re-establish limit floors if tier changed. |
| `customer.subscription.updated` | Same as created. On upgrade: set `usagePeriodStart = now()`. On downgrade: set `usagePeriodStart` to Stripe's `current_period_start` (no reset). |
| `customer.subscription.deleted` | Drop user to `free`, status `cancelled`, clear `stripeSubscriptionId`, re-establish free-tier floors. |
| `invoice.payment_failed` | Set `subscriptionStatus` to `past_due`. |

**Checkout session creation:**
- `createSubscriptionCheckout()` — Stripe Checkout in `subscription` mode. Price from `TierLimitConfig.stripePriceId` or env var fallback.
- `createCreditPackCheckout()` — one-time `payment` mode. Price resolved from `CreditPack` based on user's current tier. Validates `creditPurchasesEnabled`. Session metadata includes `userId`, `creditPackId`, `credits`, `packName`.
- `createBillingPortalSession()` — Stripe Customer Portal for subscription management.

Tier resolution from Stripe price ID: checks env vars first, then falls back to `TierLimitConfig.stripePriceId`.

### Admin Subscription Controls (`/admin/subscription-settings`)

Three sections:

**Tier Limits:** For each tier, admins can edit: Q&A queries per month (blank = unlimited), images per month (blank = unlimited), allowed AI models, credit cost per query, credit cost per image, display price string, and the `creditPurchasesEnabled` toggle. Changes saved via `PATCH /api/admin/subscription-config/tiers`, take effect immediately (30s cache cleared).

**Credit Packs:** Create, edit, delete packs. Each pack has name, credit quantity, per-tier prices (in cents), active toggle, and sort order.

**Recent AI Service Failures:** Scrollable log of recent `AiServiceFailure` records for monitoring.

### Per-User Admin Controls (`/admin/users/[userId]`)

Tabbed view with:
- **Account tab:** Usage (current period vs limits, all-time totals, credit balance, floors), partner books.
- **Subscription tab:** Override user's tier (bypasses Stripe), add `UserQuotaOverride` (custom limits with optional expiry and reason), adjust credit balance manually, view/revoke active `UserGrant` records, view credit transaction history, view quota overrides.
- **Badges tab:** Award or revoke user badges (e.g. "OG" early-adopter badge).

### Onboarding Plan Picker (`/onboarding/plan`)

- Fetches plan data dynamically from DB via `getPublicTierPlans()` — no hardcoded limits on the page.
- Three plan cards: Free, Standard, Premium. Premium currently marked "Coming Soon".
- During beta, Standard shows struck-through price + "Free during beta" badge.
- On selection, calls `completePlanStep()` server action — writes tier to `User`, establishes limit floors.
- "Request Partner Access" path sets Standard and creates a partner request record.
- **Stripe checkout is not yet invoked from this page** — tier is set directly in DB during beta. The checkout flow exists in `lib/stripe.ts` but is not wired to the plan picker yet.

### Quota Exhausted Modal (`components/subscription/quota-exhausted-modal.tsx`)

Shown when API returns HTTP 429 with `error: "LIMIT_REACHED"`. Displays: used vs limit count, reset date, credit balance if available, per-action credit cost. CTAs: "View plans & upgrade" → `/onboarding/plan`; "Buy credit packs" → `/account#credits` (only if `creditPurchasesEnabled`). Never shows a generic toast for quota exhaustion.

### AI Failure Notice (`components/subscription/ai-failure-notice.tsx`)

Shown when API returns HTTP 502 with `error: "AI_FAILURE"`. Distinct from quota modal. Message: "Oops — something went wrong on our end. We've reported it to the site admin. This will not be deducted from your allowance or credits." Failure logged async (fire-and-forget) to `AiServiceFailure` via `reportAiServiceFailure()` — never delays the user's error response.

### Account Page Usage Section (`/account`)

Shows: monthly quota bars for Q&A and images (colour shifts to error-red at limit), billing cycle reset date and days remaining, subscription tier badge, beta mode notice if applicable, credit balance below each bar, credit transaction log (purchases, spends, admin adjustments). Data server-rendered from `getUserUsageSummary()`, refreshable client-side via `GET /api/account/usage`.

### Reporting Capabilities

| Report | How derived |
|---|---|
| Per-user monthly usage (queries) | `COUNT(Query WHERE userId AND createdAt >= periodStart)` |
| Per-user monthly usage (images) | `COUNT(GeneratedImage WHERE userId AND createdAt >= periodStart)` |
| Per-user all-time queries | `COUNT(Query WHERE userId)` |
| Per-user all-time images | `COUNT(GeneratedImage WHERE userId)` |
| Per-user credit balance | `SUM(CreditTransaction.amount WHERE userId)` |
| Per-book total queries | `COUNT(Query WHERE bookId)` |
| Per-book total images | `COUNT(GeneratedImage WHERE bookId)` |
| Per-book credit spend | `SUM(ABS(CreditTransaction.amount) WHERE bookId AND reason IN (SPEND_QUERY, SPEND_IMAGE))` |
| Credit purchase history | `CreditTransaction WHERE reason = PURCHASE` (includes `stripePaymentIntentId` for reconciliation) |

### Subscription & Quota Key Files

| File | Purpose |
|---|---|
| `lib/subscription.ts` | Core quota logic: `checkUsageLimit`, `getEffectiveLimits`, `resolveBillingPeriod`, `getUserUsageSummary`, `consumeUsageAfterSuccess` |
| `lib/credits.ts` | Credit ledger: `getCreditBalance`, `addCreditTransaction`, `spendCreditsIfNeeded` |
| `lib/stripe.ts` | All Stripe interactions: webhook handler, checkout and portal session creation |
| `lib/tier-limit-config.ts` | DB-backed tier config with 30s cache; `getPublicTierPlans()`, `invalidateTierLimitConfigCache()` |
| `lib/limit-floors.ts` | Grandfathering: `establishLimitFloorsForTier`, `applyLimitFloors`, `ensureLimitFloorsInitialized` |
| `lib/ai-service-failure.ts` | `reportAiServiceFailure()` (async, fire-and-forget) and `aiFailureResponse()` |
| `lib/ai-failure-constants.ts` | User-facing AI failure message string |
| `lib/onboarding-plan-action.ts` | Server action for onboarding plan selection |
| `app/api/imagine/route.ts` | Image generation endpoint with quota gate |
| `app/api/query/route.ts` | Q&A endpoint with quota gate |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook receiver |
| `app/api/billing/checkout/subscription/route.ts` | Subscription checkout session |
| `app/api/billing/checkout/credits/route.ts` | Credit pack checkout session |
| `app/api/billing/portal/route.ts` | Stripe billing portal session |
| `app/api/account/usage/route.ts` | Client-side usage refresh |
| `app/api/account/credits/route.ts` | Credit transaction history |
| `app/api/admin/subscription-config/tiers/route.ts` | Admin tier limit management |
| `app/api/admin/subscription-config/credit-packs/[id]/route.ts` | Admin credit pack CRUD |
| `app/api/admin/users/route.ts` | Paginated user list |
| `app/api/admin/users/[userId]/route.ts` | Full user detail + tier override |
| `app/api/admin/users/[userId]/grants/route.ts` | Create/revoke UserGrant |
| `app/api/admin/users/[userId]/quota-overrides/route.ts` | Add quota override |
| `app/api/admin/users/[userId]/credits/route.ts` | Manual credit adjustment |
| `app/api/admin/users/[userId]/badges/route.ts` | Award/revoke badges |
| `app/api/admin/ai-failures/route.ts` | Recent AI failure log |
| `components/subscription/quota-exhausted-modal.tsx` | Quota exhausted UI (429 response) |
| `components/subscription/ai-failure-notice.tsx` | AI failure UI (502 response) |
| `components/subscription/usage-period-panel.tsx` | Usage bars with refresh |
| `components/subscription/account-usage-section.tsx` | Account page usage + credit history |
| `app/(reader)/onboarding/plan/plan-client.tsx` | Plan picker UI |
| `app/(reader)/(app)/account/account-client.tsx` | Full account page |
| `app/admin/subscription-settings/subscription-settings-client.tsx` | Admin tier + pack management UI |
| `app/admin/users/users-client.tsx` | Admin user list |
| `app/admin/users/[userId]/user-detail-client.tsx` | Per-user admin management |

---

## Theming

Six dev palettes, toggled via `data-theme` attribute on `<html>`. `DevPaletteSwitcher` writes `data-theme` to `<html>` and persists via cookie (`novelviz_dev_palette`). Server reads this cookie to set `data-theme` at SSR time in `app/layout.tsx`.

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

## Discover Page (`/books`)

`app/(public)/discover/discover-catalogue-client.tsx` + `discover-redesign.css` + `lib/discover-catalogue.ts`.

Both `/books` and `/discover` render `DiscoverCatalogueClient`. Nav "Discover" link → `/books`.

Sections: hero, search bar, scrolling marquee, featured carousel (drag-to-scroll, tilt mechanic, active book info panel), Community Visions strip (fetches `GET /api/gallery/book/[bookId]?featured=true&limit=8`), genre filter pills, browse grid.

Reader count: `_count.userBooks` where `isActive: true`, added to `getDiscoverFeaturedBooks` in `lib/discover-catalogue.ts`.

---

## Gallery

### Surfaces

- `/gallery` — main page: FROM YOUR LIBRARY + FEATURED
- `/gallery/[bookId]` — full image grid for one book

### `/gallery` — Redesign Status

CSS prompt written (`gallery-redesign.css`) — **not yet implemented**. Planned: ambient glow, spoiler pill repositioned, FROM YOUR LIBRARY grid, `✦` dividers, FEATURED horizontal carousel, masonry Browse All with tab row, CTA banner.

### `/gallery` — Current Data Logic

**FROM YOUR LIBRARY:** mixed latest images from all library books, per-book + global gating applied.

**FEATURED:** `GeneratedImage` where `isPublic === true`, ordered by `likeCount desc` then `createdAt desc`, top 20. No `isFeatured` filter — popularity-based.

**Guest view:** FEATURED shown fully. FROM YOUR LIBRARY shows ~5 blurred decorative images as CTA.

### Spoiler Protection Hierarchy

**1. Global** — `User.globalSpoilerProtection` (bool, default true). Toggleable on `/gallery`.

**2. Per-book** — `UserBook.spoilerProtection` (INHERIT / PROTECTED / UNLOCKED, default INHERIT).

**3. Session override** — `/gallery/[bookId]` only. `sessionStorage['novelviz_session_unlocks']` as `{ [bookId]: true }`. Amber banner shown while active.

**Resolution order:**
1. Not logged in → show everything
2. Session override active → show everything
3. UserBook === UNLOCKED → show everything
4. UserBook === PROTECTED → gate to progress
5. UserBook === INHERIT + global false → show everything
6. UserBook === INHERIT + global true → gate to progress
7. Book not in library → show everything

**Gating:** locked if `image.chapterNumberAtTime > ReadingProgress.currentChapter`

**Comment visibility follows the same hierarchy.**

### `/gallery/[bookId]`

Header: cover, title, author, public image count, SpoilerToggle (cycles INHERIT→PROTECTED→UNLOCKED→INHERIT), session buttons, amber banner. Grid: locked images show blur + lock icon + "Chapter X". Click → popup modal.

### Padlock Icons (visible cards only, logged-in users only)

| Icon | Colour | Condition |
|---|---|---|
| 🔓 Aqua `#00BCD4` | Your image | `image.userId === currentUserId` |
| 🔓 Red `#EF4444` | Per-book UNLOCKED, global PROTECTED | UserBook=UNLOCKED + global=true |
| 🔓 Green `#22C55E` | Safe — within reading progress | chapter ≤ current, protection active |
| 🔓 Yellow `#EAB308` | Global protection off | global=false |

Priority: aqua > red > green > yellow. Clickable icons not yet implemented.

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
- **`PENDING_CONTENT_REVIEW`** — Reader-flagged for inappropriate content. Author sees it with notice; others cannot.
- **`DELETED`** — Soft delete. Never returned from listing API.

### Core Visibility Logic — `getCommentViewerPresentation`

Single source of truth in `lib/comment-viewer-presentation.ts` (re-exported as `lib/comment-visibility.ts`).

**Outputs:** `listVisible`, `revealContent`, `spoilerLocked`, `lockMessage`, `chapterGap`, `showAuthorReview`, `showPendingSpoilerNotice`, `showContentReviewNotice`, `showAuthorSpoilerConfirmedNotice`.

**Key rules:**
- `PENDING_CONTENT_REVIEW`: only admin, session override, or comment author get `listVisible`.
- `HIDDEN_SPOILER`: admins + session override always see full content. Author always sees content with `showAuthorReview` until admin sets `spoilerModerationAt`; after confirm-keep, `showAuthorSpoilerConfirmedNotice`. Other readers: lock (behind gate, pre-admin-confirm), pending spoiler notice (past gate, scan not admin-confirmed), or full text (past gate, post admin-confirm).
- Spoiler gate math: `isBehindSpoilerCommentGate` in `lib/gallery-spoiler.ts`.

### Automated Spoiler Scan

`lib/comment-scan.ts` (`scanCommentForSpoilers`). New comments created as `VISIBLE`. Scan calls `getAnthropicTextResponse` with JSON-shaped prompt. Spoiler → `HIDDEN_SPOILER`, `spoilerGateChapter` set, `COMMENT_HIDDEN_PENDING` notification to author. Fail-open: scan failure leaves comment VISIBLE.

Inline vs `after()` controlled by `shouldAwaitCommentSpoilerScan()` in `lib/comment-spoiler-scan-debug.ts`.

Re-scan triggered after: author rewords a `HIDDEN_SPOILER` comment back to visible, or admin restores a `PENDING_CONTENT_REVIEW` comment.

### Comment API Routes

#### `GET /api/comments?imageId=…&session=true|false`
Returns non-deleted comments filtered by `listVisible`. Per-comment flags: `canEdit`, `canDelete`, `canFlag`, `canAdminModerateContent`, `canAdminModerateSpoiler`, `canAdminConfirmSpoilerGated`. Marked `dynamic`.

#### `POST /api/comments`
Auth required. `{ imageId, content }` (trimmed, 1–500 chars). Creates VISIBLE comment on a public image of a published book. Triggers spoiler scan.

#### `PATCH /api/comments/[commentId]`

| Action | Who | Effect |
|---|---|---|
| `reword` | Author | Updates content. If `PENDING_CONTENT_REVIEW`, content changes only. Otherwise resets to `VISIBLE`, clears gate fields, re-scans. |
| `reinstate` | Author or admin | `HIDDEN_SPOILER` → `VISIBLE`, clears gates. Admin sends `COMMENT_RELEASED`; author sends `COMMENT_REINSTATED`. |
| `confirm_spoiler` | Admin | `disposition: 'delete'` → soft delete + `COMMENT_SPOILER_REMOVED`. `disposition: 'keep'` → sets `spoilerModerationAt` + `COMMENT_SPOILER_CONFIRMED_GATED`. |
| `confirm_spoiler` | Author (non-admin) | Visible → `HIDDEN_SPOILER` (self-flag). |
| `moderate_content` | Admin only | `PENDING_CONTENT_REVIEW`: `delete` → soft delete + notify; `restore` → `VISIBLE`, re-scan + `COMMENT_FLAGGED_RESTORED`. |

#### `DELETE /api/comments/[commentId]`
Author or admin. Soft-delete. Admin deleting someone else's comment → `COMMENT_FLAGGED_REMOVED` to author.

#### `POST /api/comments/[commentId]/flag`
Logged-in non-author with `revealContent`. Sets `PENDING_CONTENT_REVIEW`. Notifies author (`COMMENT_REPORTED_TO_AUTHOR`) and all admins (`COMMENT_FLAGGED_FOR_MODERATION`).

### Admin Moderation Queues

**Spoiler Comments Queue** — `HIDDEN_SPOILER` where `spoilerModerationAt` is null. Actions: reinstate or confirm_spoiler (keep / delete). Preview via `SpoilerReviewGalleryModal`.

**Flagged Comments Queue** — `PENDING_CONTENT_REVIEW`. Actions: moderate_content (restore / delete).

### Key Comment Files

| File | Purpose |
|---|---|
| `lib/comment-viewer-presentation.ts` | Core per-viewer visibility logic |
| `lib/comment-visibility.ts` | Re-export |
| `lib/comment-scan.ts` | Async Claude spoiler scan |
| `lib/comment-spoiler-scan-debug.ts` | Controls inline vs after() scan |
| `lib/gallery-spoiler.ts` | `isBehindSpoilerCommentGate` and gate helpers |
| `lib/admin-spoiler-comments-queue.ts` | Spoiler queue data + counts |
| `lib/admin-flagged-comments-queue.ts` | Flagged queue data + counts |
| `lib/notifications.ts` | `createNotification()` helper |
| `lib/resolve-db-user-from-session.ts` | Resolves DB user from Clerk session |
| `app/api/comments/route.ts` | GET + POST |
| `app/api/comments/[commentId]/route.ts` | PATCH + DELETE |
| `app/api/comments/[commentId]/flag/route.ts` | Flag for moderation |
| `components/gallery/gallery-image-comments.tsx` | Comment section UI |
| `components/gallery/spoiler-review-gallery-modal.tsx` | Admin preview modal |

---

## Notifications

Bell icon in nav. Dropdown on click. No full inbox page in v1. Polls `GET /api/notifications` every 60 seconds. On click: opens dropdown, calls `PATCH /api/notifications/read-all`.

**Dropdown:** ~340px, right-aligned. Up to 15 most recent (last 30 days), newest first. Icon per type: book (BOOK_*), star (FEATURE_REQUEST_*), speech bubble (COMMENT_*). Each item links to `notification.link`. Marks single as read on click via `PATCH /api/notifications/[id]/read`.

### Notification API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/notifications` | Last 30 days, limit 15, + unread count |
| PATCH | `/api/notifications/read-all` | Mark all read |
| PATCH | `/api/notifications/[id]/read` | Mark single read |

---

## Gutenberg Import Pipeline

Four npm scripts, all loading `.env` then `.env.local` via `scripts/lib/load-env.ts`:

| Command | Script | Purpose |
|---|---|---|
| `npm run gutenberg-fetch` | `scripts/gutenberg-fetch.ts` | Build/refresh discovery queue |
| `npm run gutenberg-ingest` | `scripts/gutenberg-ingest.ts` | EPUB ingest + OL metadata + covers + embeddings |
| `npm run gutenberg-enrich` | `scripts/gutenberg-enrich.ts` | Backfill for books ingested before unified ingest |
| `npm run gutenberg-park-deferred` | `scripts/gutenberg-park-deferred.ts` | Move blocked titles (no EPUB / too large) to deferred file |

**Queue files (gitignored):**
- `scripts/gutenberg-queue.json` — active discovery queue
- `scripts/gutenberg-queue-deferred.json` — parked/blocked titles (`no_epub`, `epub_too_large`)

### Canonical Description Helper

**Always use** `resolveGutenbergCatalogDescription(gutenbergId, summaries)` from `lib/gutenberg-page-summary.ts` for any code that needs PG descriptions.

**Description priority:**
1. Gutendex `summaries[0]` (strip `(This is an automatically generated summary.)`)
2. Scrape `https://www.gutenberg.org/ebooks/{id}` when Gutendex empty (400ms throttle; `[gutenberg-scrape]` on failure)
3. Open Library → EPUB OPF → subject-tag blurb

### Step 1 — Discovery (`gutenberg-fetch`)

Calls Gutendex for up to 1000 popular English titles. Resolves `gutenbergSummary` per row via `resolveGutenbergCatalogDescription`. Writes `gutenberg-queue.json`.

`pickEpubUrl()` prefers Gutendex no-images EPUB; derives `https://www.gutenberg.org/ebooks/{id}.epub.noimages` if only illustrated EPUB3 is listed.

**Discovery filters:**
- Title hard-reject (case-insensitive): `poems`, `collection of`, `translated into english`, `essays`, `library of`, `encyclopaedia/encyclopedia`, `works of`, `stories`
- Subject/bookshelf hard-reject: medicine, law, engineering, cookery, etc. (`HARD_REJECT_TERMS`)
- Soft review: history, biography, poetry (subjects), religion, etc. (`SOFT_REVIEW_TERMS`). Exception: `folklore`, `mythology`, `drama` auto-accept.

Flags: `--delta` (skip already in DB), `--verbose`

### Step 2 — Review (`/admin/gutenberg-import`)

Tabs: Accepted (default checked), Needs review, Rejected, Deferred, Flagged. Click "Queue approved books" sets `approved: true`. Ingest only processes `approved: true` rows not in deferred file.

**Gutenberg admin navigation** (`lib/gutenberg-admin-nav.ts`):

| Link | URL |
|---|---|
| Import queue | `/admin/gutenberg-import` |
| Deferred | `?tab=deferred` |
| Needs review | `?tab=review` |
| Accepted | `?tab=accepted` |

API: `GET/PATCH /api/admin/gutenberg-queue`

### Step 3 — Ingest (`gutenberg-ingest`)

Requires `DATABASE_URL`, `OPENAI_API_KEY`, `CLOUDINARY_URL`, `GUTENBERG_ADMIN_USER_ID`.

Per approved book:
1. Skip if `gutenbergId` already in DB
2. No `epubUrl` → park to deferred (`no_epub`), remove from active queue
3. Download EPUB (120s timeout)
4. EPUB > 4.5 MB → park (`epub_too_large`)
5. `resolveGutenbergBookEnrichment` (in `lib/open-library-cover.ts`) — description (PG summary → OL), cover (EPUB → Gutendex JPEG → OL via Cloudinary), `openLibraryKey`, `publishedYear`
6. Parse chapters, chunk, embed (OpenAI genre + embeddings)
7. Status → `pending_review` (or `draft` if genre classification fails — `[SKIP-GENRE]`)

2s pause between books. `--resume` retries failed (not deferred) books.

**Ingest outcomes:** Succeeded, Deferred (no EPUB / too large), Failed (stays on active queue for `--resume`), Skipped (already in DB), Skip genre (saved as `draft`, no chunks).

**Cleaning after messy run:** `npm run gutenberg-park-deferred` then `npm run gutenberg-ingest -- --resume`

### Step 4 — Publish

Books land in `pending_review`. Use For Review dashboard queue or `/admin/books/[id]`. Discover requires `published` status + cover image.

### Backfill Descriptions (`gutenberg-enrich`)

```bash
npm run gutenberg-enrich -- --gutenberg-summaries --dry-run
npm run gutenberg-enrich -- --gutenberg-summaries --status pending_review
```

Eligible when description is empty, starts with `in published order`, starts with `Public domain classic. Subjects:`, or is Gutenberg search chrome text. See `isDescriptionEligibleForGutenbergSummaryBackfill` in `lib/book-description.ts`.

### Gutenberg-Related Files

| Path | Role |
|---|---|
| `scripts/gutenberg-fetch.ts` | Discovery |
| `scripts/gutenberg-ingest.ts` | Full ingest |
| `scripts/gutenberg-park-deferred.ts` | Bulk-park blocked titles |
| `scripts/gutenberg-enrich.ts` | Optional backfill / cover refresh |
| `scripts/lib/gutenberg-types.ts` | Queue + defer reason types |
| `scripts/lib/gutenberg-deferred.ts` | Read/write/park/restore deferred file |
| `scripts/lib/gutenberg-filters.ts` | Accept/reject filters + `pickEpubUrl` |
| `scripts/lib/gutenberg-queue-flags.ts` | Manual-upload flags + labels |
| `scripts/lib/load-env.ts` | Env loading for CLI scripts |
| `lib/gutenberg-page-summary.ts` | Canonical `resolveGutenbergCatalogDescription` + scrape |
| `lib/book-description.ts` | Normalize PG summary text; `pickBestDescription` |
| `lib/book-description-resolve.ts` | Non-ingest description resolve |
| `lib/open-library.ts` | OL search + work metadata |
| `lib/open-library-cover.ts` | Unified metadata + cover resolution (`resolveGutenbergBookEnrichment`) |
| `lib/book-rejection-notes.ts` | Prepend rejection reason to `internalNotes` |
| `lib/gutenberg-admin-nav.ts` | Admin nav links for Gutenberg section |
| `lib/admin-helpers-nav.ts` | Admin Helpers nav |
| `app/admin/gutenberg-import/` | Review + deferred UI |
| `app/api/admin/gutenberg-queue/route.ts` | Queue API |

---

## For Review Queue (Admin Dashboard)

Both Gutenberg ingest and partner/admin EPUB uploads land in `pending_review`. The For Review queue in the admin dashboard is the moderation gate for both.

A book is in the queue when `Book.status === 'pending_review'` and `Book.deletedAt === null`.

**Initial load:** `loadAdminDashboardData()` in `lib/dashboard-data.ts` loads first 50 `pending_review` books (`updatedAt desc`) and total count. Sidebar badge = total count.

**Search:** 300ms debounce → `GET /api/admin/books?filter=pending_review&skip=0&take=50&q=<query>`. While searching, UI shows API results only.

**Pagination:** "Load next 50" → `GET /api/admin/books?filter=pending_review&skip=<length>&take=50`. Appends unique rows client-side.

### Row Actions

**Approve** — `PATCH /api/admin/books/{id}/status`. Target status from `listingPreferenceAfterReview`:
- `null` or `"published"` → `published`
- `"unlisted"` → `unlisted`

Sends `BOOK_APPROVED` notification to partner. Clears `listingPreferenceAfterReview` and `rejectionReason`.

**Reject** — Requires ≥ 20 character reason. `PATCH .../status` with `{ status: "rejected", rejectionReason }`. Prepends rejection block to `Book.internalNotes` via `lib/book-rejection-notes.ts`. Sends `BOOK_REJECTED` notification. Note: modal says "set to draft" but API sets `rejected`; partner returns to draft via Resubmit.

**Delete** — `DELETE /api/admin/books/{id}` — soft-delete.

**Details** — Link to `/admin/books/[id]` with `returnTo` preserving dashboard tab.

### Admin Book Detail (`/admin/books/[id]`)

Same moderation outcomes + Chapter Manager (edit titles, merge, single delete, bulk delete tab), Internal notes textarea (rejection block appears here), status dropdown.

### Partner Side

- `draft` → `pending_review`: sets `listingPreferenceAfterReview`
- `pending_review` / `rejected` → `draft`: clears listing preference; clears `rejectionReason` when leaving rejected
- Partner sees `rejectionReason` on book page; can edit and resubmit

---

## Admin Helpers

Grouped under **Helpers** in top nav and dashboard sidebar (`lib/admin-helpers-nav.ts`, `components/admin/admin-helpers-nav.tsx`). Gutenberg import is a separate nav group.

| Helper | URL | Purpose |
|---|---|---|
| Cover refresh | `/admin/cover-refresh` | Lists `pending_review` books with generic PG cover JPEG. Scans OL for better cover; upload via Cloudinary. API: `GET/POST /api/admin/cover-refresh`. |
| Bulk chapter delete | (in Helpers) | Search phrase, select books, delete matching chapter titles across pending books. |

---

## Book Ingestion Pipeline

1. Upload EPUB via admin/partner page
2. Cover extracted from EPUB manifest → Cloudinary (`novelviz/covers/[bookId]`)
3. Genre detected via GPT-4o-mini (max 20 tokens). Token usage → `Book.ingestionPromptTokens` + `Book.ingestionCompletionTokens`
4. Chapters parsed from `toc.ncx` navMap; Gutenberg boilerplate filtered
5. Each chapter chunked (~500 tokens, ~50 overlap)
6. Chunks embedded via `text-embedding-3-small`, stored via raw SQL pgvector insert
7. Book status → `ready_for_review`
8. Open Library enrichment runs as non-blocking post-ingestion step

Post-ingestion: admin can edit chapters via Chapter Manager. Finalise (`POST /api/admin/books/[bookId]/finalise`) deletes all chunks, re-chunks, re-embeds, sets status back to `ready_for_review`.

**EPUB size limit:** >4.5MB hits Vercel payload limit. Use no-images Gutenberg EPUBs.

---

## Open Library Metadata Enrichment

Non-blocking post-ingestion step. Never overwrites existing data.

**Enriches:** `Book.description` (if blank), `Book.publishedYear` (if null), `Book.openLibraryKey`.

**How:** `openlibrary.org/search.json?q=[title+author]&limit=5`, pick best match. No API key. `AbortSignal.timeout(8000)`. Log prefix: `[open-library]`.

**Key file:** `lib/open-library.ts`

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

**Call 1 — Subject Extraction** (`max_tokens: 50`): primary visual subject. Token usage → `subjectTokens`.

**Dual vector search:** embeds both `userPrompt` and `extractedSubject`, 5 chunks each, merged + deduplicated to max 8.

**Call 2 — Prompt Enrichment** (`max_tokens: 300`): detailed image gen prompt.

#### Comment Spoiler Scan

Claude call via `getAnthropicTextResponse`, `max_tokens: 100`. Fire-and-forget or inline. See Comments section.

### Image Generation Models

**Library Imagine (`POST /api/imagine`):**

| Model | Endpoint | Price | Who |
|---|---|---|---|
| xai/grok-imagine-image | `xai/grok-imagine-image` | $0.02/image | Readers, partners, admins (default) |
| Seedream v4.5 | `bytedance/seedream/v4.5/text-to-image` | $0.04/image | Admin only |
| flux/schnell | `fal-ai/flux/schnell` | ~$0.003/image | Admin only (dev/test) |

`GeneratedImage.model` records which model was used. All schnell-generated images must be deleted before production launch.

**Cover AI (`POST /api/books/[id]/cover-ai/generate`):**

| Model | Key | Who |
|---|---|---|
| flux/schnell | `flux-schnell` | Admin only |
| xai/grok-imagine-image | `grok` | Admin only |
| Seedream v4.5 | `seedream-v45` | Partners (no choice) + Admin |

Model list is configured via `CoverAiAdminSettings` (`lib/cover-ai-settings.ts`). `lib/cover-ai-fal.ts` maps `inputProfile` to fal input shape per model.

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

Cost constants and helpers in `lib/costs.ts`.

### AI Error Handling

- OpenAI embed fail → 500
- Anthropic 404 → fall through to next candidate. All fail → 502 via `aiFailureResponse()`.
- fal.ai fail → 502 via `aiFailureResponse()`
- fal.ai no URL → 502, full response logged
- Cloudinary upload fail → 502. Never saves fal URL to DB.
- Comment scan fail → logged, comment stays VISIBLE (fail open)
- All AI failures logged async to `AiServiceFailure` table. Quota is never deducted on failures.

### Key AI Files

| File | Purpose |
|---|---|
| `lib/anthropic.ts` | Anthropic client singleton |
| `lib/ingestion.ts` | OpenAI embeddings, chunking, EPUB parsing, genre detection |
| `lib/fal.ts` | fal.ai client (Library Imagine) |
| `lib/cover-ai-fal.ts` | fal.ai client for Cover AI; maps inputProfile to fal input shape |
| `lib/cover-ai-prompt.ts` | `assembleCoverAiPrompt` — base prefix + overlay title/author blocks + publisher description |
| `lib/cover-ai-settings.ts` | `CoverAiAdminSettings` singleton — models, prompt templates |
| `lib/cover-ai-access.ts` | `canAccessBookCoverAi`, `resolveCoverAiQuotaExempt`, draft path validation |
| `lib/comment-scan.ts` | Async Claude comment spoiler scan |
| `lib/costs.ts` | Cost constants + estimation helpers |
| `lib/open-library.ts` | Open Library metadata enrichment |
| `lib/discover-catalogue.ts` | Featured books query |
| `lib/upload-prepared-image-to-cloudinary.ts` | Sharp resize/JPEG + Cloudinary upload helper (shared by Cover AI and Library Imagine) |
| `lib/prepare-fal-image-for-cloudinary.ts` | `fetchAndPrepareFalImageForCloudinary` — fetch fal URL, sharp resize, stay under 10MB |
| `components/ui/image-generation-loader.tsx` | Shared infinity-sparks loader component (Cover AI modal + Library Imagine) |
| `components/ui/image-generation-loader.css` | Loader animations — scoped under `.image-generation-loader`, reduced-motion safe |
| `components/cover-ai/cover-ai-modal.tsx` | Cover AI modal UI — carousel, quota display, generate/commit/discard flows |
| `app/api/query/route.ts` | Q&A endpoint |
| `app/api/imagine/route.ts` | Library image generation endpoint |
| `app/api/books/[id]/cover-ai/config/route.ts` | Cover AI config — models, quota, prompt suggestions |
| `app/api/books/[id]/cover-ai/generate/route.ts` | Cover AI generate — fal + Cloudinary draft upload + quota increment |
| `app/api/books/[id]/cover-ai/commit/route.ts` | Commit chosen draft to `novelviz/covers/{bookId}`, destroy all drafts |
| `app/api/books/[id]/cover-ai/discard-drafts/route.ts` | Best-effort Cloudinary draft cleanup on modal close |
| `app/api/books/[id]/cover-ai/request-more/route.ts` | Partner quota exhaustion request |
| `app/admin/cover-ai-settings/` | Admin UI for base prompt, title/author templates, model list |
| `app/api/admin/books/[id]/ingest/route.ts` | Book ingestion + OL enrichment |
| `app/api/admin/books/[bookId]/finalise/route.ts` | Re-chunking after chapter edits |

---

## Featured Image System

`GeneratedImage.isFeatured` controls the Discover page "Community Visions" strip. Separate from the Gallery FEATURED carousel (which uses likes/recency, no `isFeatured` filter).

**Admin:** direct toggle via `PATCH /api/admin/images/[imageId]/feature`. No request needed.

**Partner:** requests via Images tab → `POST /api/feature-requests`. Appears in admin Feature Approvals.

Admin approve → `APPROVED`, `isFeatured = true`, `FEATURE_REQUEST_APPROVED` notification. Admin reject → `REJECTED`, `FEATURE_REQUEST_REJECTED` notification. Rejected can be re-requested (old record deleted first).

### Feature Request API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/feature-requests` | Submit request |
| PATCH | `/api/feature-requests/[requestId]` | Approve or reject (admin) |
| DELETE | `/api/feature-requests/[requestId]/remove` | Remove featured status (admin) |
| PATCH | `/api/admin/images/[imageId]/feature` | Direct admin toggle |

---

## Cover AI

Partners and admins can generate portrait (3:4) cover candidates for a book using fal.ai, preview up to five drafts in a modal carousel, then commit one as the official `Book.coverImageUrl`. Entirely separate from the Library Imagine feature.

### Entry Points

| Surface | File | How modal opens |
|---|---|---|
| Partner book detail | `app/(partner)/partner/books/[id]/partner-book-detail-client.tsx` | "Generate AI cover" button |
| Admin book detail | `app/admin/books/[id]/admin-book-detail-client.tsx` | Same modal; shows publisher quota panel when `book.ownerLabel` set |
| After create book | `app/(partner)/partner/books/new/new-book-form.tsx` | Optional checkboxes → redirect `?openCoverAi=1&coverIncludeTitle=1&coverIncludeAuthor=1` |

### Create-book Flow

Step 1 (upload form) has three checkboxes: **Generate AI cover**, **Include book title on cover**, **Include author name on cover**. If the first is checked, the other two become visible. On Next, the user is redirected to the book detail page which auto-opens the Cover AI modal with overlay fields pre-filled from book metadata (`overlayTitle`, `overlayAuthor`) based on which boxes were checked. Empty overlay field → that block is omitted from the fal prompt.

### Modal UI (`components/cover-ai/cover-ai-modal.tsx`)

**Form fields:** model selector (admin only; partners always get Seedream v4.5), publisher prompt (required), book title overlay, author overlay.

**Loading state:** `ImageGenerationLoader` rendered inline inside `aspect-[3/4] max-w-xs` portrait frame — not a full-screen overlay.

### Five-Preview Carousel

```ts
type DraftSlide =
  | { kind: "loading"; slotId: string }
  | { kind: "ready"; slotId: string; imageUrl: string; publicId: string }
```

- `loading` slides do **not** count toward the 5-preview cap — only `ready` slides count (`CAROUSEL_MAX = 5`).
- Failed generation removes the loading slide; no quota charge.
- Closing modal without committing triggers best-effort `discard-drafts` for all ready `publicId`s.
- Committing destroys all drafts (chosen + others) in Cloudinary.

**Important distinction:** 5 previews = drafts open at once in this session (UI cap). Quota = successful DB-tracked generations per book (separate).

### Partner Quota

Fields on `Book`:
- `coverGenAttemptsGranted` — default **5**
- `coverGenAttemptsConsumed` — incremented only after successful fal generate **and** Cloudinary draft upload (not on failure)

`remainingAttempts = max(0, granted - consumed)`. Quota is **permanently recorded** — counts never reset automatically, providing an audit trail for abuse detection.

**Admins are always quota-exempt** (`resolveCoverAiQuotaExempt` in `lib/cover-ai-access.ts`).

**Admin quota management:** Admin book detail page shows used/granted/remaining + **Reset publisher allowance** button (`resetCoverGenQuota: true` on `PATCH /api/admin/books/[id]` → sets `coverGenAttemptsConsumed = 0`, clears pending requests).

**Partner quota request:** When `consumed >= granted`, partner can request more via `POST /api/books/[id]/cover-ai/request-more`. Creates `CoverAiQuotaRequest` if none pending.

### Prompt Assembly (`lib/cover-ai-prompt.ts`)

`assembleCoverAiPrompt` builds:
1. Base prefix (from `CoverAiAdminSettings`)
2. Title block — only if `overlayTitle` trimmed non-empty (template with `{{title}}`)
3. Author block — only if `overlayAuthor` trimmed non-empty (template with `{{author}}`)
4. Publisher description (required)

Admin can configure base prefix and title/author templates at `/admin/cover-ai-settings`.

### Generate Pipeline

1. Validate `modelKey`, access, quota (partners only)
2. `assembleCoverAiPrompt`
3. `fal.subscribe` via `lib/cover-ai-fal.ts` (portrait 3:4 per model profile)
4. Upload to Cloudinary folder **`novelviz/cover-drafts/{bookId}`** via `uploadFalImageUrlToCloudinary` (sharp resize/JPEG, <10MB)
5. Increment `coverGenAttemptsConsumed` if partner

### Commit Pipeline

1. Validate `chosenPublicId` is under `novelviz/cover-drafts/{bookId}/`
2. Re-upload to **`novelviz/covers`** with `public_id = bookId`, 400×600 fit
3. Update `Book.coverImageUrl`
4. Destroy chosen + all other draft `publicId`s (best-effort)

### Common Mistakes (for agents)

- Confusing with Library Imagine — different API, different Cloudinary folder (`novelviz/gallery` vs `novelviz/cover-drafts`), no book quota on Library Imagine
- Quota increments on successful Cloudinary upload, not on Generate click or fal success alone
- Loading slides do not count toward the 5-preview cap
- Final committed cover lands in `novelviz/covers/{bookId}`, not the drafts folder
- Admins are exempt by **role**, not by book status

---

## My Library (`/library`)

Redesigned as "currently reading" experience. CSS: `library-redesign.css` — **prompt written, implementation in progress**.

Three sections: page header, open book animation + contextual panel, bookshelf + stats strip.

**Open book animation:** pure CSS 3D, no animation library. Phases: `closed` → `opening` (80ms) → `open` (600ms) → content fades in (800ms). Page background: fixed parchment gradient (not theme tokens). Switching books: panel fades, book closes, data swaps, book reopens.

**Active book:** defaults to most recent `ReadingProgress` update; falls back to first by `UserBook.createdAt`.

**Contextual panel:** Continue reading card (particle canvas bg), Q&A prompt card (most recent Query as context), Image nudge card.

**Bookshelf:** tilt mechanic (±1.5deg), spring hover, mini progress bar per cover, active book lifted + accent border, `✦` dot indicator, dashed placeholder at end.

**Stats strip:** Books in Library, Total Questions Asked, Total Images Created.

---

## Dashboard

Role-aware left-sidebar shell. CSS: `dashboard-redesign.css` — **prompt written, implementation in progress**.

**Layout:** sticky top bar (logo / dev role switcher / avatar), 220px left sidebar (user name + role + nav + badge counts), main content area.

**Nav by role:**
- Reader: Overview · Currently Reading · My Images · Q&A History · Account
- Partner (+ divider): My Books · Analytics · Feature Requests
- Admin (+ divider): For Review · Spoiler Comments · Flagged Comments · Feature Approvals · Helpers · All Books · All Users · Admin Stats · Subscription Settings

**Admin comment queues in sidebar:** Spoiler Comments (HIDDEN_SPOILER, `spoilerModerationAt` null), Flagged Comments (PENDING_CONTENT_REVIEW). Both with badge counts.

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

**Admin Stats:** KPI grid, 30-day activity sparkline, AI cost table (operation / count / est. cost, including comment scans), vendor billing cards (OpenAI, fal.ai, Anthropic estimated, Neon stubbed).

**Token fields on Query:** `embeddingTokens`, `promptTokens`, `completionTokens`
**Token fields on GeneratedImage:** `embeddingTokens`, `promptTokens`, `completionTokens`, `subjectTokens`
**Token fields on Book:** `ingestionPromptTokens`, `ingestionCompletionTokens`

---

## Image Storage

### Library Imagine

1. fal.ai returns temporary CDN URL
2. Generate `imageId = randomUUID()`
3. Upload to Cloudinary: `folder: "novelviz/gallery"`, `public_id: imageId`
4. Store `cloudinaryResult.secure_url` in `GeneratedImage.imageUrl`
5. Cloudinary upload fail → 502 via `aiFailureResponse()`, nothing saved to DB

### Cover AI

1. fal.ai returns temporary CDN URL
2. `uploadFalImageUrlToCloudinary` — fetch URL, sharp resize (max 2048, JPEG, <10MB), upload to `novelviz/cover-drafts/{bookId}` with random UUID `public_id`
3. Draft `imageUrl` + `publicId` returned to modal carousel
4. On commit: re-upload chosen draft to `novelviz/covers/{bookId}` (400×600 fit), update `Book.coverImageUrl`, destroy all draft `publicId`s
5. On discard/close: best-effort destroy all draft `publicId`s

### Cloudinary Folders

| Folder | Contents |
|---|---|
| `novelviz/covers/[bookId]` | Official committed book covers |
| `novelviz/cover-drafts/[bookId]/[uuid]` | Temporary Cover AI draft previews — destroyed on commit or discard |
| `novelviz/gallery/[imageId]` | Library Imagine generated images |

Cloudinary plan: Free tier (25 credits/month). OL covers fetched via Cloudinary remote fetch (not stored as direct third-party URLs).

---

## Open Items

### Pre-launch tweaks (in progress)

- Landing page — add 3-column "how it works" section under hero title
- Partner UX — make "upload new book" more discoverable
- Dashboard — reduce redundancy, generally confusing to navigate
- Image generation loading — `ImageGenerationLoader` infinity-sparks component built; integration in progress
- Clerk login + plan picker onboarding flow — **in progress**
- Library "currently reading" sort order — needs investigation
- Gallery — surface images related to user genre interests
- Featured books logic audit — key partner marketing point, needs to be solid
- Credit pack purchase UI for readers — backend fully supports it; in-app storefront for browsing and purchasing packs (beyond the Stripe portal button) is minimal
- Onboarding plan Stripe checkout — plan picker currently sets tier directly in DB (no Stripe payment) during beta; checkout flow exists in `lib/stripe.ts` but is not wired yet

### V2 / Planned

- Full notification inbox page
- Threaded comment replies
- Entity extraction per chapter → improve image gen accuracy + character consistency
- Batch Gutenberg ingestion via background queue (QStash or Trigger.dev)
- Retailer affiliate links + click tracking
- Email: Resend (contact form) + Loops (mailing list)
- Non-chapter content handling (poems, prologues, interludes currently dropped)
- Add-to-library spoiler preference checkbox
- Neon consumption API integration in admin stats (after Launch plan upgrade)
- Open Library cover image fallback (`cover_i` field captured, not yet used)
- Batch Open Library enrichment for existing books
- Comment scan token tracking in admin stats cost table
- Partner portal at `/partner/dashboard`
- Cover AI: AI-assisted prompt generation (send book context to Claude/OpenAI, partner tweaks)
- Cover AI: model choice for partners (currently fixed to Seedream v4.5)
- FAQ page entries explaining upgrade/downgrade quota reset behaviour and billing policies
- Content moderation layer (pre-send filtering — currently AI model-level filtering only)
- Native mobile app (React Native; PWA as interim)

### Known Edge Cases

- EPUB >4.5MB: Vercel payload limit. Fix: direct browser→Cloudinary upload.
- Non-chapter content (poems, interludes, prologues) dropped during EPUB parsing.
- Gutenberg `dc:date` = digitisation date — Open Library enrichment fixes for new ingestions.
- Open Library may occasionally match wrong edition for common titles.
- Comment scan is fail-open: scan failure leaves comment VISIBLE.
- `PENDING_CONTENT_REVIEW` comments invisible to all readers except author and admins — slow admin review means legitimate comment appears missing with no explanation.
- Cover AI draft cleanup is best-effort — orphaned drafts in `novelviz/cover-drafts/` possible if modal closed mid-generate.
- Credit pack reader storefront is minimal — users reach credit purchase via Stripe portal rather than an in-app pack picker.
- Stripe checkout not yet connected to onboarding plan picker — tier is set directly in DB during beta.

---

## Dev Workflow

- Claude writes all Cursor prompts → Chris pastes into Cursor Composer
- Plan mode before Agent mode for multi-file tasks
- Commit after each session before switching machines (laptop ↔ desktop)
- `CURSOR.md` + `NOVELVIZ_REFERENCE_v5.md` maintained as persistent context
- `dev` branch → staging; merge to `main` → production
- Domain: novelviz.com — DNS on Namecheap → Vercel. Do not delete DNS records.
- **gitignore `!` prefix is a footgun** — never use near env files. `.env.example` was tracked, credentials exposed, all keys rotated. Always audit gitignore rules.
- JSX prototypes provided to Cursor as reference files — Cursor reads for visual/structural intent and wires to real data, does not use mock data
- Queue files (`gutenberg-queue.json`, `gutenberg-queue-deferred.json`) are gitignored — copy between machines to share approvals and deferred lists
- General questions unrelated to the codebase asked in plain chats (not project chats) to avoid token overhead from project file injection
