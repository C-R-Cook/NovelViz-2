# NovelViz — Quota, Payment & Credit System Report

> **Purpose:** This document is a reference-manual source for Claude. It describes the quota and credit system from two angles: (1) the user/navigation experience and (2) the technical/code implementation. All file paths are relative to the project root `c:\Users\vfxch\projects\NovelViz-2\`.

---

## 1. Overview

NovelViz offers reader subscriptions at three tiers — **Free**, **Standard**, and **Premium**. Each tier carries a monthly allowance of two types of AI actions:

- **Q&A Queries** — asking questions about a book (`POST /api/query`)
- **Image Generations** — generating book-scene images (`POST /api/imagine`)

When the monthly allowance is exhausted, users can optionally draw from a **credit balance** (purchased separately as one-time credit packs). Credits never expire and survive tier changes and billing cycles.

A **Beta Mode** flag (`BETA_MODE=true` env var) bypasses all limit enforcement, while still recording usage for monitoring purposes.

---

## 2. User-Facing Experience (Navigation / UX)

### 2.1 Onboarding — Plan Selection

**Route:** `/onboarding/plan`  
**File:** `app/(reader)/onboarding/plan/plan-client.tsx`

When a user first registers, they are directed to the plan picker page. This page:

- Fetches plan data dynamically from the database via `lib/tier-limit-config.ts` (`getPublicTierPlans()`). There are **no hardcoded tier limits** on the page — Q&A counts, image counts, prices, and allowed models all come from the `TierLimitConfig` database table.
- Displays three plan cards: **Free**, **Standard**, and **Premium**. Premium is currently marked "Coming Soon" and is not selectable.
- During beta, Standard shows a struck-through price and a "Free during beta" badge.
- On selection, calls the `completePlanStep()` server action, which writes the chosen tier to the `User` table and establishes "limit floors" (grandfathering protection) for that tier.
- Also offers a "Request Partner Access" path, which sets Standard and creates a partner request record.

### 2.2 Account Page — Usage Meter

**Route:** `/account`  
**File:** `app/(reader)/(app)/account/account-client.tsx`, `components/subscription/account-usage-section.tsx`, `components/subscription/usage-period-panel.tsx`

The account page has a dedicated usage/credits section that shows:

- **Monthly quota bars** for both Q&A and Image Generations, with percentage fill and colour change to error-red when at the limit.
- **Billing cycle info:** which day of the month the billing period resets, and how many days remain.
- **Current subscription tier badge.**
- **Beta mode notice** (shown in amber) if applicable.
- **Credit balance** shown below each usage bar if credits are available.
- **Credits & Purchase History section** (anchored at `#credits`): shows current credit balance and a full chronological transaction log. Transaction types displayed: `Credit pack purchase`, `Question`, `Image generation`, `Admin adjustment`.
- A "Manage subscription" button appears when `creditPurchasesEnabled` is true for the user's tier; this opens the Stripe Billing Portal.

The usage data is server-rendered from `getUserUsageSummary()` and can be client-refreshed by hitting `GET /api/account/usage`.

### 2.3 Quota Exhausted Modal

**File:** `components/subscription/quota-exhausted-modal.tsx`

When a user hits their quota limit and the API returns `error: "LIMIT_REACHED"` (HTTP 429), the frontend does **not** show a generic error toast. Instead, it renders a modal that:

- States clearly: "Monthly allowance used."
- Shows how many they've used vs. their limit (e.g. "50 of 50 images").
- States when the allowance resets (e.g. "in 12 days (Jun 19)").
- If the user has a credit balance, shows how many credits they have and the per-action credit cost.
- Presents two CTAs:
  1. **"View plans & upgrade"** — links to `/onboarding/plan`.
  2. **"Buy credit packs"** — links to `/account#credits` (only shown if `creditPurchasesEnabled` is true for their tier).
- A "Close" button to dismiss.

### 2.4 AI Failure Notice

**File:** `components/subscription/ai-failure-notice.tsx`, `lib/ai-failure-constants.ts`

When an AI upstream call fails (Anthropic, OpenAI, or fal.ai), the API returns `error: "AI_FAILURE"` (HTTP 502). The frontend shows a distinct **alert dialog** (not a quota modal) with the message:

> "Oops — something went wrong on our end. We've reported it to the site admin. This will not be deducted from your allowance or credits."

The failure is automatically logged to the `AiServiceFailure` database table with the user ID, route, book ID, and error summary. This is **non-blocking** — the log write happens async (fire-and-forget) so it never delays the user's error response.

### 2.5 Reader Experience During Image Generation / Q&A

When a user is reading a book and submits an image request or asks a question:

1. The frontend sends the request.
2. If successful, usage meters update client-side immediately (via `bumpUsageMeter()`) so the progress bar feels live.
3. If quota is exhausted, the `QuotaExhaustedModal` appears.
4. If an AI service fails, the `AiFailureNotice` dialog appears.

### 2.6 Admin Panel — Subscription Settings

**Route:** `/admin/subscription-settings`  
**File:** `app/admin/subscription-settings/subscription-settings-client.tsx`

Admins access a settings page with three sections:

**Tier Limits section:** For each tier (Free, Standard, Premium), admins can edit:
- Q&A queries per month (blank = unlimited)
- Images per month (blank = unlimited)
- Allowed AI models (one per line)
- Credit cost per query
- Credit cost per image
- Display price (marketing string, e.g. "$5/mo")
- Toggle: Allow credit pack purchases on this tier

Changes are saved via `PATCH /api/admin/subscription-config/tiers` and take effect immediately for all users on that tier (with a 30-second cache window from `lib/tier-limit-config.ts`).

**Credit Packs section:** Admins can create, edit, and delete credit packs. Each pack has:
- Name
- Credit quantity
- Price (in cents) for Free tier users
- Price (in cents) for Standard tier users
- Price (in cents) for Premium tier users
- Active toggle

**Recent AI Service Failures section:** Shows a scrollable list of recent `AiServiceFailure` records (route, user email, error summary) for admin monitoring.

### 2.7 Admin Panel — User Management

**Route:** `/admin/users`  
**File:** `app/admin/users/users-client.tsx`

A sortable, searchable table of all users with tier badges, status indicators, and links to individual user detail pages.

**Route:** `/admin/users/[userId]`  
**File:** `app/admin/users/[userId]/user-detail-client.tsx`

A tabbed detail view per user with three tabs:

- **Account tab:** User info (email, username, role, Clerk ID, Stripe customer ID, join date), usage section (current period queries/images vs limits, all-time totals, credit balance, grandfathered limit floors), and partner books (if applicable).
- **Subscription tab:** Admin can:
  - Override the user's subscription tier directly (bypasses Stripe).
  - Add a quota override (set custom query/image limits, optionally with an expiry date and reason). These take precedence over global tier limits.
  - Adjust credit balance manually (positive or negative amount with a note).
  - View active grants (tier upgrades, query/image bonuses) and revoke them.
  - View credit transaction history.
  - View existing quota overrides.
- **Badges tab:** Award or revoke user badges (e.g. "OG" early-adopter badge).

---

## 3. Technical / Code Implementation

### 3.1 Database Schema (`prisma/schema.prisma`)

**Key models related to the payment/credit system:**

| Model | Purpose |
|---|---|
| `TierLimitConfig` | One row per tier. Stores `queriesPerMonth`, `imagesPerMonth`, `allowedModels`, `creditPurchasesEnabled`, `creditCostQuery`, `creditCostImage`, `displayPriceMonthly`, `stripePriceId`. Admin-editable. The single source of truth for all tier limits. |
| `CreditPack` | Admin-configured one-time purchase packs. Fields: `name`, `credits`, `active`, `priceFree`, `priceStandard`, `pricePremium` (all in cents), `stripePriceId`, `sortOrder`. |
| `CreditTransaction` | Immutable credit ledger. One row per transaction. Fields: `userId`, `amount` (positive = add, negative = spend), `reason` (enum: `PURCHASE`, `SPEND_QUERY`, `SPEND_IMAGE`, `ADMIN_ADJUST`), `bookId`, `creditPackId`, `stripePaymentIntentId`, `grantedBy`, `note`. The current credit balance is `SUM(amount)` for a given user. |
| `UserQuotaOverride` | Per-user limit override that takes precedence over global tier config. Fields: `queriesLimit`, `imagesLimit`, `expiresAt` (nullable), `reason`, `grantedBy`. |
| `UserGrant` | Legacy and current bonus grants. Used for tier upgrades, query bonuses, and image bonuses. Fields: `grantType` (TIER_UPGRADE / QUERY_BONUS / IMAGE_BONUS), `source` (ADMIN / SYSTEM / PURCHASE), `tierValue`, `bonusAmount`, `usedAmount`, `expiresAt`. |
| `AiServiceFailure` | Failure log. Fields: `userId`, `route`, `bookId`, `errorSummary`. Indexed by `createdAt` for admin monitoring. Quota is never deducted on logged failures. |
| `User` | Includes: `subscriptionTier`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `usagePeriodAnchor`, `usagePeriodStart`, `queriesLimitFloor`, `imagesLimitFloor`, `queriesUnlimitedFloor`. |

**Key enums:**

- `SubscriptionTier`: `free`, `standard`, `premium`
- `SubscriptionStatus`: `active`, `cancelled`, `past_due`, `trialing`
- `GrantType`: `TIER_UPGRADE`, `QUERY_BONUS`, `IMAGE_BONUS`
- `GrantSource`: `ADMIN`, `SYSTEM`, `PURCHASE`
- `CreditTransactionReason`: `PURCHASE`, `SPEND_QUERY`, `SPEND_IMAGE`, `ADMIN_ADJUST`

**Tier vs. Role distinction:** `UserRole` (reader / partner / admin) is separate from `SubscriptionTier` (free / standard / premium). Role controls platform access type; tier controls AI action allowances. Admins have unlimited usage — they bypass quota checks entirely.

### 3.2 Quota Enforcement — API Routes

**`POST /api/imagine`** (`app/api/imagine/route.ts`)  
**`POST /api/query`** (`app/api/query/route.ts`)

Both routes follow the same enforcement pattern before any AI processing:

1. **Auth check:** Verify the user is signed in via Clerk and exists in the DB.
2. **Quota check:** Call `checkUsageLimit(userId, "image" | "query")` from `lib/subscription.ts`. This returns `{ allowed, used, limit, resetDate, creditBalance, creditCost, usesCredits }`.
3. **Reject if not allowed:** Return HTTP 429 with a structured body: `{ error: "LIMIT_REACHED", limitType, used, limit, resetDate, creditBalance, creditCost, tier, creditPurchasesEnabled }`. This is what triggers the `QuotaExhaustedModal` on the client.
4. **Proceed:** Run the AI pipeline (embeddings → vector search → Anthropic/fal → Cloudinary upload → DB write).
5. **Handle AI failures:** Any exception in the AI pipeline calls `aiFailureResponse(userId, route, bookId, error)` which logs to `AiServiceFailure` and returns HTTP 502 with `{ error: "AI_FAILURE", message: "...", deducted: false }`.
6. **Post-success consumption:** After successful DB write, call `consumeUsageAfterSuccess(userId, type, bookId)`. This checks if monthly quota has been exceeded (meaning credits were needed), and if so, deducts the appropriate credit cost via the ledger.

**Important:** `Query` and `GeneratedImage` records are only created on success. Failed AI calls produce no usage records. Monthly quota counting is done by simply counting `Query` and `GeneratedImage` rows since `periodStart`.

### 3.3 Quota Logic — `lib/subscription.ts`

**`checkUsageLimit(userId, type)`**

The core gate function. Logic flow:

1. If user is `admin` role → `allowed: true`, no further checks.
2. Get effective limits via `getEffectiveLimits()`.
3. Resolve current billing period via `resolveBillingPeriod()`.
4. Count monthly usage via `countMonthlyUsage()` (counts `Query` or `GeneratedImage` rows since `periodStart`).
5. Get credit balance via `getCreditBalance()` (sum of all `CreditTransaction.amount`).
6. Check legacy top-up grants via `sumLegacyTopUpAvailable()` (for migrated users).
7. Decision tree:
   - `limit === null` (unlimited) → allowed
   - `monthlyUsed < limit` → allowed (using quota)
   - `creditBalance >= creditCost` → allowed (will use credits)
   - `legacyTopUp > 0` → allowed (legacy path)
   - Otherwise → **not allowed**
8. If `BETA_MODE=true` → force allowed regardless.

**`getEffectiveLimits(userId)`**

Resolves the actual limits for a user, accounting for multiple override layers:

1. Read user's `subscriptionTier`.
2. Call `ensureLimitFloorsInitialized()` to set floors if first call (lazy initialisation).
3. Check for active `UserGrant` records:
   - `TIER_UPGRADE` grants can push the effective tier higher.
4. Load `TierLimitConfig` for the effective tier.
5. Apply "limit floors" via `applyLimitFloors()` — global admin decreases can never reduce a user below the limit they had when they first subscribed/upgraded (grandfathering protection).
6. Check for active `UserQuotaOverride` — if one exists, it completely replaces the tier-derived limit.
7. If no override, apply `QUERY_BONUS` and `IMAGE_BONUS` grants as additive amounts.

**`resolveBillingPeriod(userId)`**

Returns `{ periodStart, resetDate }`:
- If `user.usagePeriodStart` is set (Stripe-provided), use it directly.
- Otherwise, calculate from `usagePeriodAnchor` (day of month) and the current date.
- Reset date is always exactly one calendar month after `periodStart`, with end-of-month clamping.

**`consumeUsageAfterSuccess(userId, type, bookId)`**

Called after a successful operation. Only deducts credits if the user's monthly usage is now *above* their limit (i.e., they're into credit territory). Calls `spendCreditsIfNeeded()` from `lib/credits.ts`.

### 3.4 Credits — `lib/credits.ts`

Three functions:

- **`getCreditBalance(userId)`**: Aggregates `SUM(amount)` from `CreditTransaction` for the user.
- **`getCreditTransactions(userId, options)`**: Returns paginated transaction history.
- **`addCreditTransaction(params)`**: Inserts a new ledger row (used for both purchases and spends).
- **`spendCreditsIfNeeded(params)`**: Checks if the user's monthly used exceeds their limit; if so, and if credit balance is sufficient, inserts a negative `CreditTransaction` row.

The balance is always derived from the ledger sum — there is no mutable `creditBalance` column on the user. This provides a full audit trail.

### 3.5 Tier Limit Config — `lib/tier-limit-config.ts`

- **`getAllTierLimitConfigs()`**: Reads all three `TierLimitConfig` rows from DB, with a **30-second in-memory cache** to avoid per-request DB hits.
- **`invalidateTierLimitConfigCache()`**: Called after admin saves tier changes to clear the cache immediately.
- **`getPublicTierPlans()`**: Returns a safe public projection (no Stripe price IDs) used by the plan picker page.

### 3.6 Limit Floors — `lib/limit-floors.ts`

The "grandfathering" system. When a user first signs up or upgrades, their current tier limits are snapshotted onto the `User` row as `queriesLimitFloor`, `imagesLimitFloor`, and `queriesUnlimitedFloor`.

- **`establishLimitFloorsForTier(userId, tier)`**: Takes a snapshot of the current tier config and writes it to the user. Called on: plan selection, subscription checkout completion, subscription update webhook, subscription deletion webhook.
- **`ensureLimitFloorsInitialized(userId, tier)`**: Idempotent — only calls `establish...` if floors haven't been set yet (backfill path for legacy accounts).
- **`resolveLimitWithFloor(global, floor, unlimitedFloor)`**: Returns `max(global, floor)`. If the admin raises a global limit, all users benefit. If the admin lowers it, existing users stay at their floor.

### 3.7 Stripe Integration — `lib/stripe.ts`

**Webhook handler (`handleStripeWebhook`)**

Listens to four Stripe event types:

| Event | Handler | Action |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutCompleted` | If subscription mode: update user tier, `usagePeriodStart`, Stripe IDs, establish floor. If payment mode: credit the user's ledger with the purchased pack credits (idempotent via `stripePaymentIntentId` check). |
| `customer.subscription.created` | `handleSubscriptionUpdated` | Sync tier, status, `usagePeriodStart`. If tier changed, re-establish limit floors. |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Same as above. On **upgrade** (new tier rank > old tier rank): `usagePeriodStart` is set to `new Date()` (now), giving the user a fresh billing period and effectively resetting their monthly quota counter. On **downgrade**: `usagePeriodStart` is set to Stripe's `current_period_start` (no reset — user keeps current tier's limit until natural cycle end). |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Drops user back to `free`, sets status `cancelled`, clears `stripeSubscriptionId`, re-establishes free-tier floors. |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Sets user `subscriptionStatus` to `past_due`. |

**Tier resolution** from Stripe: first checks env vars (`STRIPE_PRICE_ID_FREE/STANDARD/PREMIUM`), then falls back to looking up `TierLimitConfig.stripePriceId`.

**Checkout session creation:**

- `createSubscriptionCheckout(params)`: Creates a Stripe Checkout session in `subscription` mode. Price ID comes from `TierLimitConfig.stripePriceId` or env var fallback.
- `createCreditPackCheckout(params)`: Creates a one-time `payment` mode session. Price is determined by the user's current tier (`priceFree` / `priceStandard` / `pricePremium` from `CreditPack`). Validates that `creditPurchasesEnabled` is true for the user's tier before proceeding. Session metadata includes `userId`, `creditPackId`, `credits`, and `packName` for the webhook to process.
- `createBillingPortalSession(params)`: Creates a Stripe Customer Portal session for subscription management.

### 3.8 Admin API Routes

**`PATCH /api/admin/subscription-config/tiers`** — Update tier limits (invalidates cache).  
**`POST/PATCH/DELETE /api/admin/subscription-config/credit-packs/[id]`** — CRUD for credit packs.  
**`GET /api/admin/users`** — Paginated, searchable, sortable user list.  
**`GET /api/admin/users/[userId]`** — Full user detail payload (user info, usage stats, grants, credit transactions, quota overrides, owned books).  
**`PATCH /api/admin/users/[userId]`** — Override a user's subscription tier directly.  
**`POST /api/admin/users/[userId]/grants`** — Create a UserGrant (tier upgrade, query/image bonus, permanent or with expiry).  
**`PATCH /api/admin/users/[userId]/grants/[grantId]`** — Revoke a grant (sets `expiresAt` to now).  
**`POST /api/admin/users/[userId]/quota-overrides`** — Add a quota override for a user.  
**`POST /api/admin/users/[userId]/credits`** — Manual credit adjustment (inserts `ADMIN_ADJUST` transaction).  
**`POST/DELETE /api/admin/users/[userId]/badges`** — Award or revoke user badges.  
**`GET /api/admin/ai-failures`** — Recent AI failure log (used in subscription settings page).

### 3.9 User-Facing Account API Routes

**`GET /api/account/usage`** — Returns `UserUsageSummary` (used by the usage panel's client-side refresh).  
**`GET /api/account/credits`** — Returns credit transaction history for the account page.  
**`POST /api/billing/checkout/subscription`** — Creates a Stripe subscription checkout session URL.  
**`POST /api/billing/checkout/credits`** — Creates a Stripe credit pack checkout session URL.  
**`POST /api/billing/portal`** — Creates a Stripe Billing Portal session URL.  
**`POST /api/webhooks/stripe`** — Receives and processes all Stripe webhook events.

### 3.10 AI Failure Handling — `lib/ai-service-failure.ts`

- **`reportAiServiceFailure(params)`**: Async (fire-and-forget) DB write to `AiServiceFailure`. Error truncated to 2000 chars.
- **`aiFailureResponse(userId, route, bookId, error)`**: Calls `reportAiServiceFailure` (void, non-blocking) then immediately returns a `NextResponse` with HTTP 502 and the standard friendly failure payload.
- **Message constant** in `lib/ai-failure-constants.ts`: `"Oops — something went wrong on our end. We've reported it to the site admin. This will not be deducted from your allowance or credits."`

### 3.11 Reporting Capabilities

The system supports the following stats:

| Report | How it's derived |
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

---

## 4. Upgrade / Downgrade Behaviour

| Event | Quota Reset? | Credit Balance? | Timing |
|---|---|---|---|
| Upgrade (tier rank increases) | **Yes** — `usagePeriodStart` set to now, giving full new-tier allowance immediately | Unchanged | Immediate on Stripe webhook |
| Downgrade (tier rank decreases) | **No** | Unchanged | Takes effect at next natural billing cycle end (Stripe handles) |
| Credit pack purchase | N/A | Increases by pack credits | Immediate on Stripe checkout webhook |
| Admin tier override | No automatic reset | Unchanged | Immediate (no Stripe) |
| Admin credit adjustment | N/A | Increases or decreases by adjustment amount | Immediate |

---

## 5. Beta Mode

`BETA_MODE=true` (env var) is a site-wide toggle. When active:

- `checkUsageLimit()` always returns `allowed: true` and `usesCredits: false`, regardless of usage counts.
- `consumeUsageAfterSuccess()` effectively no-ops (since limits are always within range).
- The `UsagePeriodPanel` component shows an amber banner: "Beta mode — usage is shown for monitoring; limits are not enforced yet."
- The admin user detail page shows a similar amber notice.
- All usage is still recorded normally, so the data exists when beta ends.

---

## 6. Admin vs. Regular User

Admin users (`role === "admin"`) receive special treatment throughout:

- `checkUsageLimit()` returns `allowed: true`, `limit: null`, `creditCost: 0` for admins without querying the config at all.
- Admins are not blocked by model restrictions (`effectiveLimits.models` check is skipped for admins in the imagine route).
- Admins should not have a Stripe subscription linked — the system handles this gracefully (no Stripe errors triggered).
- Admin-generated images and queries are still recorded in the DB for audit purposes.

---

## 7. Key Files Quick Reference

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Full DB schema including all quota/credit models |
| `lib/subscription.ts` | Core quota logic: `checkUsageLimit`, `getEffectiveLimits`, `resolveBillingPeriod`, `getUserUsageSummary` |
| `lib/credits.ts` | Credit ledger: `getCreditBalance`, `addCreditTransaction`, `spendCreditsIfNeeded` |
| `lib/stripe.ts` | All Stripe interactions: webhook handler, checkout/portal session creation |
| `lib/tier-limit-config.ts` | DB-backed tier config with 30s cache; `getPublicTierPlans()` |
| `lib/limit-floors.ts` | Grandfathering logic: `establishLimitFloorsForTier`, `applyLimitFloors` |
| `lib/ai-service-failure.ts` | AI failure logging and standard error response |
| `lib/ai-failure-constants.ts` | The user-facing failure message string |
| `lib/onboarding-plan-action.ts` | Server action for onboarding plan selection |
| `app/api/imagine/route.ts` | Image generation endpoint with quota gate |
| `app/api/query/route.ts` | Q&A endpoint with quota gate |
| `app/api/webhooks/stripe/` | Stripe webhook receiver |
| `app/api/billing/checkout/subscription/route.ts` | Subscription checkout session creation |
| `app/api/billing/checkout/credits/` | Credit pack checkout session creation |
| `app/api/billing/portal/` | Stripe billing portal session creation |
| `app/api/admin/subscription-config/` | Admin tier and credit pack management APIs |
| `app/api/admin/users/[userId]/` | User-level admin actions (tier, grants, overrides, credits, badges) |
| `components/subscription/quota-exhausted-modal.tsx` | Quota exhausted UI (shown on 429 response) |
| `components/subscription/ai-failure-notice.tsx` | AI failure UI (shown on 502 response) |
| `components/subscription/usage-period-panel.tsx` | Usage bars component with refresh capability |
| `components/subscription/account-usage-section.tsx` | Account page usage + credit history section |
| `app/(reader)/onboarding/plan/plan-client.tsx` | Plan picker UI |
| `app/(reader)/(app)/account/account-client.tsx` | Full account page UI |
| `app/admin/subscription-settings/subscription-settings-client.tsx` | Admin tier + pack management UI |
| `app/admin/users/[userId]/user-detail-client.tsx` | Per-user admin management UI |

---

## 8. Known Gaps & Future Considerations (per original spec)

The following items from the original spec are noted as **not yet implemented** or **planned for the future**:

1. **Credit pack purchase UI for readers** — The backend fully supports credit pack purchases via Stripe (checkout sessions, webhook handling, ledger). However, the reader-facing storefront for browsing and purchasing packs (beyond the "Manage subscription" portal button) appears minimal. The admin can create packs, but readers currently navigate to the Stripe portal rather than an in-app pack picker.

2. **FAQ page entries** — The spec asked for a placeholder FAQ explaining the upgrade/downgrade quota reset behaviour and other billing policies. This has not been verified in the codebase.

3. **Content moderation layer** — Explicitly noted in the spec as a future addition. No pre-send filtering is currently implemented. AI model-level filtering returns `AI_FAILURE` responses when triggered, which are correctly handled as non-deducted failures. A future moderation layer will interact with the quota system.

4. **Copyright protection integration** — Noted in the spec as a future concern that will interact with the failure-handling and quota system.

5. **Onboarding plan Stripe checkout** — The plan picker currently sets the tier in the DB directly (no Stripe payment) since the site is in beta. The Stripe checkout flow for paid subscriptions exists in `lib/stripe.ts` but the plan picker doesn't invoke it yet.
