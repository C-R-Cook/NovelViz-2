# Featured Book Personalisation — Cursor Prompt

## Context

The Discover page (`/books`) has a "Community Visions" / featured carousel. Currently `isFeatured` is a boolean on `Book` that admins toggle — the same books show to every reader regardless of who they are.

This prompt implements a full personalisation system for that carousel:

1. **Scoring engine** — scores featured books against the logged-in reader's profile (genre prefs, library genres, book recency) with demographic constraints that respect partner targeting intent
2. **Partner targeting UI** — multi-select targeting fields on the partner book detail page
3. **Shared option constants** — single source of truth for age ranges and genders used at signup and in partner targeting
4. **Graceful degradation** — demographic constraints are relaxed progressively if honouring them would leave the carousel too thin; readers never see an empty or near-empty carousel

---

## Step 0 — Audit Before Writing Any Code

Before starting, read:
- `app/(public)/books/` — the discover page and `discover-catalogue-client.tsx`
- `lib/discover-catalogue.ts` — the `getDiscoverFeaturedBooks()` function
- `app/(reader)/onboarding/preferences/preferences-client.tsx` — current age/gender/country fields
- `app/(partner)/partner/books/[id]/partner-book-detail-client.tsx` — where to add targeting UI
- `app/admin/books/[id]/admin-book-detail-client.tsx` — where to show targeting panel
- `app/generated/prisma/schema.prisma` — current `Book` and `User` schema
- `lib/user-profile-options.ts` if it exists — may already define some option lists

Do not guess at field names or query shapes — confirm from the actual files.

---

## Part 1 — Shared Profile Options (`lib/user-profile-options.ts`)

Create or update `lib/user-profile-options.ts`. This is the **single source of truth** for all picker values that appear at user signup AND in partner targeting. No other file should hardcode these values.

```typescript
// lib/user-profile-options.ts

export const AGE_RANGES = [
  { value: "under-18",  label: "Under 18"  },
  { value: "18-24",     label: "18–24"     },
  { value: "25-34",     label: "25–34"     },
  { value: "35-44",     label: "35–44"     },
  { value: "45-54",     label: "45–54"     },
  { value: "55-64",     label: "55–64"     },
  { value: "65-plus",   label: "65+"       },
] as const;

export type AgeRange = typeof AGE_RANGES[number]["value"];

export const GENDERS = [
  { value: "male",              label: "Male"              },
  { value: "female",            label: "Female"            },
  { value: "non_binary",        label: "Non-binary"        },
  { value: "other",             label: "Other"             },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type GenderOption = typeof GENDERS[number]["value"];
```

Check whether the Prisma `Gender` enum already uses these exact string values. If it does, `GenderOption` should alias the Prisma type rather than redefine it. The values above must match the Prisma enum exactly — fix the constants to match the enum if they differ (not the other way around, to avoid a migration).

After creating this file, update `preferences-client.tsx` to import `AGE_RANGES` and `GENDERS` from here rather than defining them inline. Do not change any behaviour, only the import source.

---

## Part 2 — Schema: Book Targeting Fields

Add the following fields to the `Book` model in `schema.prisma`:

```prisma
featuredTargetAgeRanges   String[]   // AgeRange values; empty = all ages
featuredTargetGenders     String[]   // Gender values; empty = all genders
featuredTargetCountries   String[]   // ISO 3166-1 alpha-2 codes; empty = all countries
featuredTargetGenres      String[]   // BookGenre values; empty = use book's own genre only
```

All four fields are non-nullable arrays with empty array defaults (`@default([])`). Empty array means "no restriction — target everyone." This is intentional: absence of targeting is represented by an empty array, not null.

Generate and apply a migration:
```bash
npx prisma migrate deploy
```

Do not use `prisma migrate dev` — use `migrate deploy` only. Run `npx prisma generate` after schema changes.

---

## Part 3 — Scoring Engine (`lib/featured-book-scoring.ts`)

Create `lib/featured-book-scoring.ts`.

### Core design principle

Demographic targeting (age, gender, country) and genre targeting are **two different kinds of signal** and must be handled differently:

- **Genre preferences** are a discovery signal — a reader might enjoy a book outside their stated preferences. These are scored as positive boosts.
- **Demographic targeting** is a business commitment to the partner — if a partner has explicitly said "target 20–34 year old females," we should honour that as a constraint, not merely a mild preference. Books are excluded from a reader's carousel if they don't match the demographic constraint. However, exclusions are relaxed gracefully (country first, then gender, then age) if honouring all of them would leave the carousel too thin.
- **Book recency** is a freshness boost for new partner uploads — new titles get weighted toward the top so partners who just uploaded a book get immediate visibility.

### Types

```typescript
export interface UserScoringProfile {
  genrePreferences: string[];   // from User.genrePreferences
  libraryGenres: string[];      // genres of books in user's active library (deduplicated)
  ageRange: string | null;      // from User.ageRange
  gender: string | null;        // from User.gender
  country: string | null;       // from User.country
}

export interface FeaturedBookWithTargeting {
  // All fields from the current getDiscoverFeaturedBooks return shape, plus:
  genre: string;
  isPublicDomain: boolean;
  createdAt: Date;              // used for recency scoring
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
  featuredTargetGenres: string[];
}

export interface ScoredBook {
  book: FeaturedBookWithTargeting;
  score: number;
  isPersonalised: boolean;      // false = fallback; never surface this to readers
}
```

### Scoring constants

```typescript
// Positive boost scores
const SCORE_GENRE_PREF_MATCH    = 40;  // user preference genre matches book's effective target genres
const SCORE_LIBRARY_GENRE_MATCH = 20;  // active library book genre matches; capped at 3 matches per book
const SCORE_RECENCY_FRESH       = 30;  // book uploaded within last 7 days (partner only)
const SCORE_RECENCY_RECENT      = 15;  // 8–30 days
const SCORE_RECENCY_WARM        = 5;   // 31–90 days

// Minimum carousel slots before relaxing demographic constraints
const MIN_CAROUSEL_SLOTS = 3;
```

### `getRecencyScore(book): number`

```
function getRecencyScore(book):
  if book.isPublicDomain:
    return 0   // recency boost is for partner uploads only

  daysSinceUpload = (now - book.createdAt) / (1000 * 60 * 60 * 24)

  if daysSinceUpload <= 7:   return SCORE_RECENCY_FRESH
  if daysSinceUpload <= 30:  return SCORE_RECENCY_RECENT
  if daysSinceUpload <= 90:  return SCORE_RECENCY_WARM
  return 0
```

### `getEffectiveTargetGenres(book): string[]`

```
function getEffectiveTargetGenres(book):
  if book.featuredTargetGenres.length > 0:
    // Partner has explicitly set target genres — always include the book's own genre too
    return deduplicate([book.genre, ...book.featuredTargetGenres])
  else:
    return [book.genre]
```

### `meetsConstraints(book, profile, relaxLevel): boolean`

Demographic constraints are applied at a configurable relaxation level. Higher `relaxLevel` means fewer constraints enforced.

```
function meetsConstraints(book, profile, relaxLevel):
  // relaxLevel 0: all constraints enforced
  // relaxLevel 1: country constraint dropped
  // relaxLevel 2: country + gender constraints dropped
  // relaxLevel 3: no demographic constraints (all pass)

  // A constraint only applies if the partner has set it (non-empty array)
  // AND the user has a value for that field
  // AND the user's value is not in the target list

  // Age range constraint (dropped at relaxLevel 3 only)
  if relaxLevel < 3:
    if book.featuredTargetAgeRanges.length > 0 and profile.ageRange != null:
      if profile.ageRange not in book.featuredTargetAgeRanges:
        return false

  // Gender constraint (dropped at relaxLevel 2+)
  if relaxLevel < 2:
    if book.featuredTargetGenders.length > 0 and profile.gender != null:
      if profile.gender not in book.featuredTargetGenders:
        return false

  // Country constraint (dropped at relaxLevel 1+)
  if relaxLevel < 1:
    if book.featuredTargetCountries.length > 0 and profile.country != null:
      if profile.country not in book.featuredTargetCountries:
        return false

  return true
```

**Important:** if the user has not set a value for a given field (e.g. `profile.gender` is null because the user skipped it), that constraint is not applied — we cannot exclude someone based on information we don't have.

### `scoreBook(book, profile): number`

This scores the positive signals only. Demographic constraints are handled separately in `rankFeaturedBooks`.

```
function scoreBook(book, profile):
  score = 0
  effectiveGenres = getEffectiveTargetGenres(book)

  // Genre preference match
  for each genre in profile.genrePreferences:
    if genre in effectiveGenres:
      score += SCORE_GENRE_PREF_MATCH

  // Library genre match (capped at 3)
  libraryMatchCount = 0
  for each genre in deduplicate(profile.libraryGenres):
    if genre in effectiveGenres and libraryMatchCount < 3:
      score += SCORE_LIBRARY_GENRE_MATCH
      libraryMatchCount++

  // Recency boost (partner uploads only)
  score += getRecencyScore(book)

  return score
```

### `rankFeaturedBooks(books, profile | null, limit): ScoredBook[]`

This is the main orchestration function.

```
function rankFeaturedBooks(books, profile, limit):

  // Guest — no profile, return global order (already sorted by popularity from DB query)
  if profile is null:
    return books
      .slice(0, limit)
      .map(b => ({ book: b, score: 0, isPersonalised: false }))

  // Score all books
  scored = books.map(b => ({
    book: b,
    rawScore: scoreBook(b, profile),
  }))

  // Sort by score desc, then createdAt desc as tiebreak
  scored.sort((a, b) => b.rawScore - a.rawScore || b.book.createdAt - a.book.createdAt)

  // Apply demographic constraints with graceful relaxation
  // Try strictest first, relax if we can't fill MIN_CAROUSEL_SLOTS
  for relaxLevel in [0, 1, 2, 3]:
    passing = scored.filter(s => meetsConstraints(s.book, profile, relaxLevel))
    if passing.length >= MIN_CAROUSEL_SLOTS or relaxLevel === 3:
      result = passing.slice(0, limit)

      // If even at full relaxation we get nothing (empty featured pool), fall through
      if result.length === 0:
        return books
          .slice(0, limit)
          .map(b => ({ book: b, score: 0, isPersonalised: false }))

      return result.map(s => ({
        book: s.book,
        score: s.rawScore,
        isPersonalised: s.rawScore > 0,
      }))
```

---

## Part 4 — Update `lib/discover-catalogue.ts`

Update `getDiscoverFeaturedBooks()` to:

1. Accept an optional `userId: string | null` parameter (add before the existing `limit` param)
2. Always select the four new targeting fields on the Book query, plus `genre`, `isPublicDomain`, `createdAt`
3. When `userId` is provided, fetch the user's scoring profile in a single additional query:
   ```sql
   -- User fields:
   SELECT "ageRange", "gender", "country", "genrePreferences" FROM "User" WHERE id = $userId

   -- Library genres (separate query):
   SELECT DISTINCT b.genre FROM "UserBook" ub
   JOIN "Book" b ON ub."bookId" = b.id
   WHERE ub."userId" = $userId AND ub."isActive" = true AND b.status = 'published'
   ```
4. Pass books and profile (or null for guest) to `rankFeaturedBooks()` from `lib/featured-book-scoring.ts`
5. Return the ranked slice

Signature change:
```typescript
// Before
getDiscoverFeaturedBooks(limit?: number): Promise<FeaturedBook[]>

// After
getDiscoverFeaturedBooks(userId: string | null, limit?: number): Promise<ScoredBook[]>
```

Update all callers to pass `userId` or `null`. Fetch the current user's DB ID on the Discover page server component using the existing auth pattern — if no session exists, pass null.

---

## Part 5 — Partner Targeting UI (`/partner/books/[id]`)

Add an **"Audience Targeting"** section to the partner book detail page. Show this section only when `book.isPublicDomain === false`.

### Section layout

Section header: `AUDIENCE TARGETING` (monospace eyebrow label, matching the existing design system)

Explainer text (small, muted): "Define the audience most likely to enjoy this book. Leave a field empty to reach all readers in that group. Your book remains visible to everyone — targeting determines priority placement."

Four multi-select pill inputs (use the `MultiSelectPills` component built in Part 6):

**1. Age ranges**
- Options: `AGE_RANGES` from `lib/user-profile-options.ts`
- Placeholder: "All ages"
- Bound to: `book.featuredTargetAgeRanges`

**2. Genders**
- Options: `GENDERS` from `lib/user-profile-options.ts`
- Placeholder: "All genders"
- Bound to: `book.featuredTargetGenders`

**3. Countries** (searchable — this list is long)
- Options: full country list from `i18n-iso-countries` (already in the project, used on preferences page) — use `getNames("en")` and format as `{ value: ISO_CODE, label: COUNTRY_NAME }`
- Placeholder: "All countries"
- Searchable: true
- Bound to: `book.featuredTargetCountries`

**4. Additional genres**
- Options: all `BookGenre` enum values (pull from Prisma-generated types)
- Placeholder: "Book's own genre only"
- Helper text: "This book's genre ({book.genre}) is always included. Add genres here to also reach readers with different preferences."
- Bound to: `book.featuredTargetGenres`

### Save behaviour

Auto-save on change (debounced 800ms) via `PATCH /api/partner/books/[bookId]/targeting`. Display a subtle "Saved ✓" confirmation near the section header (fades after 2 seconds). Show an inline error message if the save fails.

### API route: `PATCH /api/partner/books/[bookId]/targeting`

- Auth: must be the book's owner (partner or admin role)
- Body: `{ featuredTargetAgeRanges, featuredTargetGenders, featuredTargetCountries, featuredTargetGenres }`
- Validate each value in each array against known valid options (using constants from `lib/user-profile-options.ts`, valid ISO codes, valid `BookGenre` enum values)
- Return 400 with specific field errors if validation fails
- Return updated targeting fields on 200

---

## Part 6 — `MultiSelectPills` Component

Build a reusable component at `components/ui/multi-select-pills.tsx`.

```typescript
interface MultiSelectPillsProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;   // shown when nothing selected
  searchable?: boolean;   // shows a filter input above the pill grid (for long lists)
  disabled?: boolean;
  helperText?: string;    // small muted text below the pills
}
```

**Visual:**
- Unselected options: outlined pill, `var(--border-default)` border, `var(--text-secondary)` text
- Selected options: `var(--accent)` background fill, `var(--text-on-accent)` text, small ✕ affordance
- On click: toggle selected state
- Searchable mode: small text input with `var(--border-subtle)` border above the pill grid; filters visible options as user types; search input clears when component loses focus
- Placeholder text shown in `var(--text-muted)` when `selected.length === 0`
- When `disabled={true}`: pills are non-interactive, reduced opacity

**Accessibility:**
- Each pill is a `<button>` element (not a div)
- `aria-pressed` reflects selected state
- Search input has a visible label (visually hidden is acceptable)
- Full keyboard operation: Tab to reach, Space/Enter to toggle

---

## Part 7 — Admin Visibility and Targeting Preview

On the admin book detail page (`/admin/books/[id]`), add a **"Audience Targeting"** section below the existing fields.

### Read/edit panel

Use `MultiSelectPills` with `disabled={false}` — admins can edit targeting directly, wired to the same `PATCH /api/partner/books/[bookId]/targeting` route. Add a small "Editing targeting" label when in edit mode so it's not accidentally modified. Show the panel for all books (including public domain), unlike the partner view.

### Targeting preview

Below the targeting fields, show a **"Targeting Preview"** panel with a "Refresh" button. On load and on refresh, calls `GET /api/admin/books/[bookId]/targeting-preview`.

The response and display:

```
Targeting Preview  (approximate, rounded to nearest 5)

Genre signal:    ~145 readers have matching genre preferences
Library signal:  ~82 readers have this genre in their active library

Demographic constraints (only applied when field is set):
  Age range:   Field not set — all ages included
  Gender:      ~210 readers match (female, non-binary)
  Country:     ~95 readers match (GB, CA, AU)

Estimated combined reach: ~230 readers
```

The "estimated combined reach" is: count of active readers who would pass `meetsConstraints` at `relaxLevel = 0` (the strictest level). Run this count in the API route as a single DB query with the relevant WHERE clauses. Round all counts to nearest 5.

### `GET /api/admin/books/[bookId]/targeting-preview` route

Admin only. Runs COUNT queries:
- Genre pref match: `COUNT(users where any genrePreference in effectiveTargetGenres)`
- Library genre match: `COUNT(distinct userIds from UserBook join Book where genre in effectiveTargetGenres and isActive)`
- Per demographic field: `COUNT(users where field in targetValues)` (only if target array is non-empty)
- Combined reach: `COUNT(users who pass meetsConstraints at relaxLevel 0)`

All counts from the `User` table where `role = 'reader'` and account is active (not cancelled subscription status). Return the raw counts; the frontend rounds to nearest 5.

---

## Part 8 — Discover Page Wiring

On the Discover page server component:

1. Get the current user's DB ID using the existing auth pattern — null for guests
2. Pass to `getDiscoverFeaturedBooks(userId, limit)`
3. No changes to the carousel UI — books arrive in personalised order, the component is unchanged

The carousel must work identically for guests (global fallback order) and logged-in users (personalised order).

---

## Migration & Rollout Notes

- All four new `featuredTarget*` fields default to `[]`, so all existing featured books appear for all readers as before (no targeting restriction = show to everyone)
- No featured book disappears — personalisation re-orders and applies demographic constraints, but graceful degradation always ensures a non-empty carousel
- `isFeatured` on `Book` remains the entry gate — only featured books enter the scoring pool
- Partners who never touch targeting get the same behaviour as before

---

## Files to Create / Modify

**Create:**
- `lib/user-profile-options.ts`
- `lib/featured-book-scoring.ts`
- `components/ui/multi-select-pills.tsx`
- `app/api/partner/books/[bookId]/targeting/route.ts`
- `app/api/admin/books/[bookId]/targeting-preview/route.ts`

**Modify:**
- `prisma/schema.prisma` — add four targeting fields to `Book`
- `lib/discover-catalogue.ts` — add userId param, fetch scoring profile, call rankFeaturedBooks
- `app/(public)/books/` server component — pass userId to getDiscoverFeaturedBooks
- `app/(reader)/onboarding/preferences/preferences-client.tsx` — import AGE_RANGES and GENDERS from user-profile-options.ts
- `app/(partner)/partner/books/[id]/partner-book-detail-client.tsx` — add Targeting section
- `app/admin/books/[id]/admin-book-detail-client.tsx` — add Targeting panel and preview

**Migration:** one migration for the four `String[]` fields on `Book`

---

## Constraints and Reminders

- `prisma migrate deploy` only — never `prisma migrate dev`
- Import Prisma client via `@db` alias
- CSS custom properties only — never hardcoded colours
- `MultiSelectPills` must be keyboard-accessible
- Scoring logic in `featured-book-scoring.ts` must be a pure computation — no DB calls inside it
- The `isPersonalised` flag and all scoring internals must never appear in reader-facing UI
- Discover page must remain fully server-renderable; pass userId from server, do not add client-side auth fetching
- Run `npx prisma generate` after schema changes
