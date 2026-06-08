# Featured Book Scoring — Admin UI, Weight Config & History
**Prompt 2 of 2** — Depends on Prompt 1 (scoring engine, schema, partner targeting UI) being complete and verified.

---

## Context

Prompt 1 implemented:
- `lib/featured-book-scoring.ts` — pure scoring engine with hardcoded weight constants
- `lib/discover-catalogue.ts` — personalised featured book query
- Schema: four `featuredTarget*` fields on `Book`
- Partner targeting UI on `/partner/books/[id]`

This prompt does three things:

1. **Lifts the hardcoded weights into the database** so admins can tune them without a code deploy — changes take effect immediately across the site
2. **Builds an admin UI** at `/admin/featured-settings` with live weight editing, a radar chart preview, a test scenario builder, and a publish/save flow with confirmation
3. **Adds a history system** with a calendar view, per-day snapshots, diff display, and a restore flow that routes through the test fields as a visual safety gate before committing

---

## Step 0 — Audit Before Writing Any Code

Read the following before starting:

- `lib/featured-book-scoring.ts` — the scoring constants defined in Prompt 1; this prompt moves them to DB
- `lib/tier-limit-config.ts` — the existing DB-backed config pattern with caching; replicate this pattern
- `app/admin/subscription-settings/` — existing admin settings page; use as visual/structural reference
- `app/generated/prisma/schema.prisma` — confirm current schema before adding models
- `app/admin/` directory structure — understand existing admin nav before adding a new page
- `lib/admin-helpers-nav.ts` and `components/admin/admin-helpers-nav.tsx` — how admin nav items are added

Do not guess at existing patterns — read the files first.

---

## Part 1 — Schema: Weight Config and History

### `FeaturedScoringConfig` (singleton)

One row only. If the row does not exist, the scoring engine falls back to the hardcoded defaults defined in `lib/featured-book-scoring.ts`. The scoring engine must never break due to a missing config row.

```prisma
model FeaturedScoringConfig {
  id        String   @id @default("singleton")
  updatedAt DateTime @updatedAt
  updatedBy String?  // User.id of the admin who last saved

  // Genre signals
  scoreGenrePrefMatch      Int @default(40)
  scoreLibraryDeep         Int @default(25)  // >50% progress through book
  scoreLibraryStarted      Int @default(20)  // currentChapter > 0
  scoreLibraryRecentUnread Int @default(5)   // added within recency window, unread
  scoreLibraryStaleUnread  Int @default(2)   // older than recency window, unread
  libraryMatchCap          Int @default(3)   // max library genre matches per book
  libraryRecencyDays       Int @default(90)  // days threshold for "recent" unread

  // Recency boost (partner uploads only, excluded for isPublicDomain)
  scoreRecencyFresh        Int @default(30)  // uploaded within recencyFreshDays
  scoreRecencyRecent       Int @default(15)  // within recencyRecentDays
  scoreRecencyWarm         Int @default(5)   // within recencyWarmDays
  recencyFreshDays         Int @default(7)
  recencyRecentDays        Int @default(30)
  recencyWarmDays          Int @default(90)

  // Demographic match bonuses (reader matches partner's target)
  scoreGenderMatch         Int @default(15)
  scoreAgeMatch            Int @default(12)
  scoreCountryMatch        Int @default(8)

  // Demographic mismatch penalties (partner has set field, reader doesn't match)
  penaltyGenderMismatch    Int @default(40)  // stored as positive; subtracted in engine
  penaltyAgeMismatch       Int @default(30)
  penaltyCountryMismatch   Int @default(15)

  // Carousel behaviour
  minCarouselSlots         Int @default(3)   // not currently used with penalty model but kept for future
}
```

### `FeaturedScoringHistory`

One row written every time an admin saves new weights. Never updated, never deleted.

```prisma
model FeaturedScoringHistory {
  id        String   @id @default(cuid())
  savedAt   DateTime @default(now())
  savedBy   String   // User.id
  savedByName String  // denormalised display name — avoids join on every history load

  // Mirror every field from FeaturedScoringConfig (copy all Int fields above)
  scoreGenrePrefMatch      Int
  scoreLibraryDeep         Int
  scoreLibraryStarted      Int
  scoreLibraryRecentUnread Int
  scoreLibraryStaleUnread  Int
  libraryMatchCap          Int
  libraryRecencyDays       Int
  scoreRecencyFresh        Int
  scoreRecencyRecent       Int
  scoreRecencyWarm         Int
  recencyFreshDays         Int
  recencyRecentDays        Int
  recencyWarmDays          Int
  scoreGenderMatch         Int
  scoreAgeMatch            Int
  scoreCountryMatch        Int
  penaltyGenderMismatch    Int
  penaltyAgeMismatch       Int
  penaltyCountryMismatch   Int
  minCarouselSlots         Int
}
```

Add `@@index([savedAt])` to `FeaturedScoringHistory` for efficient calendar queries.

Apply migration: `npx prisma migrate deploy`. Run `npx prisma generate` after.

---

## Part 2 — Config Cache (`lib/featured-scoring-config.ts`)

Replicate the `lib/tier-limit-config.ts` caching pattern exactly.

```typescript
// lib/featured-scoring-config.ts

import db from "@db";

// These are the fallback defaults if no DB row exists.
// Must match the @default values in the schema above.
export const DEFAULT_SCORING_WEIGHTS = {
  scoreGenrePrefMatch:      40,
  scoreLibraryDeep:         25,
  scoreLibraryStarted:      20,
  scoreLibraryRecentUnread: 5,
  scoreLibraryStaleUnread:  2,
  libraryMatchCap:          3,
  libraryRecencyDays:       90,
  scoreRecencyFresh:        30,
  scoreRecencyRecent:       15,
  scoreRecencyWarm:         5,
  recencyFreshDays:         7,
  recencyRecentDays:        30,
  recencyWarmDays:          90,
  scoreGenderMatch:         15,
  scoreAgeMatch:            12,
  scoreCountryMatch:        8,
  penaltyGenderMismatch:    40,
  penaltyAgeMismatch:       30,
  penaltyCountryMismatch:   15,
  minCarouselSlots:         3,
};

export type ScoringWeights = typeof DEFAULT_SCORING_WEIGHTS;

let cache: ScoringWeights | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function getScoringWeights(): Promise<ScoringWeights> {
  if (cache && Date.now() < cacheExpiry) return cache;
  const row = await db.featuredScoringConfig.findUnique({ where: { id: "singleton" } });
  cache = row ? { ...DEFAULT_SCORING_WEIGHTS, ...row } : DEFAULT_SCORING_WEIGHTS;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cache;
}

export function invalidateScoringWeightsCache() {
  cache = null;
  cacheExpiry = 0;
}
```

### Update `lib/featured-book-scoring.ts`

Change `scoreBook()`, `getRecencyScore()`, and `rankFeaturedBooks()` to accept a `ScoringWeights` parameter instead of using the hardcoded constants. The constants file keeps the `DEFAULT_SCORING_WEIGHTS` as fallback but the live functions always receive weights from the caller.

Update `lib/discover-catalogue.ts` to call `getScoringWeights()` and pass the result through to the scoring functions.

---

## Part 3 — API Routes

### `GET /api/admin/featured-scoring/config`

Admin only. Returns current config (DB row or defaults) plus the hardcoded defaults separately so the UI can show which values have been customised.

```typescript
// Response shape
{
  current: ScoringWeights,
  defaults: ScoringWeights,
  lastUpdatedAt: string | null,
  lastUpdatedBy: string | null,
}
```

### `POST /api/admin/featured-scoring/config`

Admin only. Validates all fields are positive integers (penalties stored as positive values). Upserts the singleton row. Writes a `FeaturedScoringHistory` row with the saved-by admin's ID and display name. Calls `invalidateScoringWeightsCache()`. Returns updated config.

Request body: full `ScoringWeights` object.

### `GET /api/admin/featured-scoring/history`

Admin only. Query params: `year` (number), `month` (1–12 number).

Returns all history entries for that calendar month, grouped by date:

```typescript
{
  entries: {
    date: string,           // "2026-06-14"
    changes: {
      id: string,
      savedAt: string,
      savedByName: string,
      weights: ScoringWeights,
      diff: Record<string, { from: number, to: number }> // only changed fields
    }[]
  }[]
}
```

The `diff` is computed server-side by comparing each entry to the one immediately before it (ordered by `savedAt`). For the oldest entry in the DB overall, diff against `DEFAULT_SCORING_WEIGHTS`.

---

## Part 4 — Admin Page (`/admin/featured-settings`)

Add to admin nav. Read `lib/admin-helpers-nav.ts` to understand how to add nav entries correctly — follow the exact same pattern.

The page is a single scrollable column with four sections. Use the existing admin design system throughout — monospace section labels, card surfaces, the existing colour tokens. Reference `app/admin/subscription-settings/` visually.

---

### Section 1 — Live Weights

A grid of labelled number inputs, one per weight field. Group them visually into four sub-groups with small group headers:

**Genre Signals** — scoreGenrePrefMatch, scoreLibraryDeep, scoreLibraryStarted, scoreLibraryRecentUnread, scoreLibraryStaleUnread, libraryMatchCap, libraryRecencyDays

**Recency Boost (Partner Uploads)** — scoreRecencyFresh, scoreRecencyRecent, scoreRecencyWarm, recencyFreshDays, recencyRecentDays, recencyWarmDays

**Demographic Match Bonuses** — scoreGenderMatch, scoreAgeMatch, scoreCountryMatch

**Demographic Mismatch Penalties** — penaltyGenderMismatch, penaltyAgeMismatch, penaltyCountryMismatch

Each field shows:
- Human-readable label (e.g. "Genre preference match" not "scoreGenrePrefMatch")
- The current live value in the input
- A small muted "Default: N" label so admins know what they're departing from
- A subtle highlight (amber left border on the input) when the current value differs from the default

**Save button** at the bottom of this section. On click, show a confirmation modal:

> "This will update the scoring weights immediately across the entire site. All featured book recommendations will reflect the new weights within 60 seconds. Are you sure?"

Two buttons: "Save weights" (proceed) and "Cancel." On confirm, POST to the config API, show a success toast, write to history.

The live weights section inputs are **independent from the test scenario fields** — editing live weights does not push to the test fields. The radar chart (Section 2) updates live as the admin edits either section, as described below.

---

### Section 2 — Radar Chart Preview

A `RadarChart` from Recharts, centred on the page, rendered at approximately 500×400px.

**Six radar arms:**
1. Genre Preferences
2. Library Signal
3. Recency
4. Gender
5. Age Range
6. Country

**Two polygons rendered simultaneously:**
- **Blue polygon** — scores computed from the live weights section using the test scenario data
- **Dashed grey polygon** — scores computed from `DEFAULT_SCORING_WEIGHTS` using the same test scenario data

This lets admins see at a glance how their weight changes shift the scoring shape relative to the defaults.

**Normalisation — important.** Each arm must be normalised to 0–100 for display. Do not render raw scores on the radar. The normalisation approach:

- Define a theoretical maximum for each dimension (e.g. genre prefs: max possible = scoreGenrePrefMatch × 5 genre matches; library: max = scoreLibraryDeep × libraryMatchCap; recency: max = scoreRecencyFresh; demographic per field: max = match bonus; penalty baseline = 50).
- Map the raw dimension score to 0–100 where 50 = neutral (no signal, no penalty), above 50 = positive, below 50 = penalty applied.
- The normalisation function must recompute whenever weights change, using the current weights to determine the scale.

**Below the chart**, show a small data table with the exact raw score for each dimension and the total score, so admins can see the actual numbers alongside the visual. Label the total with a qualitative tag: ≥120 = "Strong match", 60–119 = "Good match", 20–59 = "Weak match", 1–19 = "Marginal", ≤0 = "Unlikely to surface".

The chart updates in real time as either the live weights fields or the test scenario fields are edited. No save/refresh required.

---

### Section 3 — Test Scenario Builder

Two side-by-side cards: **Test Reader** and **Test Book**.

**Test Reader fields:**
- Age range — single select, options from `AGE_RANGES` in `lib/user-profile-options.ts`
- Gender — single select, options from `GENDERS` in `lib/user-profile-options.ts`
- Country — single select, searchable, from `i18n-iso-countries`
- Genre preferences — multi-select pills, `BookGenre` enum values
- Library books — a small repeatable list where each entry has:
  - Genre (select, `BookGenre` values)
  - Reading progress: "Not started" / "In progress" / "More than halfway"
  - Added: "Within last 90 days" / "Older than 90 days"
  - Add/remove buttons, up to 6 library entries

**Test Book fields:**
- Genre — single select, `BookGenre` values
- Upload date — date picker or select: "Within 7 days" / "8–30 days" / "31–90 days" / "90+ days"
- Is public domain — checkbox (disables recency scoring when checked)
- Target age ranges — multi-select pills, `AGE_RANGES`
- Target genders — multi-select pills, `GENDERS`
- Target countries — multi-select pills, searchable, `i18n-iso-countries`
- Additional target genres — multi-select pills, `BookGenre` values

All fields update the radar chart in real time as they are edited.

**Snapshot banner:** When the test fields have been populated from a history restore, show a banner at the top of this section:

> "Loaded from snapshot: 14 Jun 2026, 09:42 — saved by Chris"

The banner has an ✕ dismiss button. Editing any field clears the banner automatically, indicating the admin has departed from the historical snapshot.

**Publish button** at the bottom of this section. Same confirmation modal as the Save button in Section 1:

> "This will update the scoring weights immediately across the entire site. All featured book recommendations will reflect the new weights within 60 seconds. Are you sure?"

On confirm, the values from the test scenario's weight state (which mirror the live weights inputs — the test fields are reader/book data only, not separate weight inputs) are posted to the config API. After publish, the live weights section updates to reflect the newly saved values.

**Important clarification:** The test scenario builder contains reader and book data only. It does not have its own set of weight inputs. The weights used for the radar chart always come from the live weights section (Section 1). "Publish" saves those live weight values, not anything from the test fields themselves.

---

### Section 4 — History Calendar

Two-column layout: calendar on the left (~340px), detail panel on the right (fills remaining space).

**Calendar (left):**

Install `react-calendar`:
```bash
npm install react-calendar
```

Render a standard month calendar. Style it using CSS custom properties to match the admin design system — override `react-calendar`'s default styles completely so it does not look out of place.

Use `tileContent` to render a small dot indicator (accent colour, 4px circle) on dates that have history entries. Use `tileClassName` to add an active/highlighted class to those dates.

Month navigation (prev/next arrows) triggers a fetch to `GET /api/admin/featured-scoring/history?year=YYYY&month=M` to load that month's data. Show a loading state on the calendar tiles while fetching.

On page load, fetch the current month automatically.

**Detail panel (right):**

Initially shows a muted placeholder: "Select a date to view changes."

When a calendar date with history entries is clicked:

- If **one entry** on that date: show the detail directly.
- If **multiple entries**: show a dropdown above the detail — "3 changes on 14 Jun 2026" — listing each by time and admin name. Selecting one populates the detail below.

**Detail content:**
- Saved at (full date + time)
- Saved by (admin name)
- **Diff table** — two columns: "Field" and "Change". Only fields that differ from the previous snapshot are shown. Each row: field label | previous value → new value. Changed values highlighted in amber. If nothing changed (identical save), show "No changes from previous snapshot."
- Full weights table below the diff — all values as they were in this snapshot, changed fields highlighted, unchanged fields in muted text.
- **Restore button** at the bottom of the detail panel.

**Restore flow:**
1. Admin clicks Restore on a history snapshot.
2. The weights from that snapshot populate the **live weights fields** in Section 1 (not saved yet — just fills the inputs).
3. The snapshot banner appears in the test scenario section: "Loaded from snapshot: [date] — saved by [name]."
4. The radar chart updates immediately to reflect the restored weights against the current test scenario.
5. Page scrolls smoothly to Section 1 so the admin can review the populated fields.
6. Admin can edit the fields further or click Save to commit, which triggers the standard confirmation modal.
7. Clicking Save records a new history entry — the restore is not recorded as its own history event, only the subsequent save is.

---

## Part 5 — Navigation

Add "Featured Scoring" to the admin nav. Read `lib/admin-helpers-nav.ts` first — follow the exact existing pattern for adding entries. The page sits under the Helpers group or alongside Subscription Settings depending on how the existing nav is structured (confirm by reading the file).

---

## Files to Create / Modify

**Create:**
- `lib/featured-scoring-config.ts` — DB-backed config with cache
- `app/api/admin/featured-scoring/config/route.ts` — GET + POST
- `app/api/admin/featured-scoring/history/route.ts` — GET with year/month params
- `app/admin/featured-settings/page.tsx` — server component shell
- `app/admin/featured-settings/featured-settings-client.tsx` — full client UI

**Modify:**
- `prisma/schema.prisma` — add `FeaturedScoringConfig` and `FeaturedScoringHistory` models
- `lib/featured-book-scoring.ts` — accept `ScoringWeights` param instead of hardcoded constants
- `lib/discover-catalogue.ts` — call `getScoringWeights()` and pass through
- `lib/admin-helpers-nav.ts` — add Featured Scoring nav entry
- `components/admin/admin-helpers-nav.tsx` — if nav component needs updating

**Install:**
```bash
npm install react-calendar
npm install @types/react-calendar --save-dev
```

---

## Constraints and Reminders

- `prisma migrate deploy` only — never `prisma migrate dev`
- Import Prisma client via `@db` alias
- CSS custom properties only — never hardcoded colours; override `react-calendar` default styles completely
- The scoring engine must never break if `FeaturedScoringConfig` row does not exist — always fall back to `DEFAULT_SCORING_WEIGHTS`
- Radar chart arms must be normalised to 0–100 using current weights as the scale — do not render raw scores on the chart axes
- Two polygons on radar: live weights (blue, solid) vs defaults (grey, dashed)
- Penalties stored as positive integers in DB; subtracted in the scoring engine
- History rows are immutable — never update or delete them
- `savedByName` is denormalised onto the history row intentionally — avoids broken display if an admin account is later deleted
- Test scenario fields contain reader/book data only — weights always come from Section 1 live weight inputs
- Restore populates Section 1 live weight inputs and scrolls there — it does not auto-save
- The confirmation modal text must mention the 60-second cache window explicitly so admins understand there is a brief propagation delay
- Recharts `RadarChart` is already available in the project — no new chart library needed
- `react-calendar` styles must be scoped under a wrapper class to avoid polluting global styles
