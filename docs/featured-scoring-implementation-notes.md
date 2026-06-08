# Featured Book Scoring & Personalisation — Implementation Notes

Reference for updating the user manual. Describes what was actually built versus the plan prompts in `docs/CURSOR_scoring_admin_ui.md` (Prompt 2) and `docs/CURSOR_featured_book_personalisation.md` (Prompt 1).

---

## Executive summary

Two plan documents were implemented together, but **the live scoring model follows Prompt 2 (admin weights / penalty–bonus model), not Prompt 1's exclusion / `relaxLevel` model**. The admin UI at `/admin/featured-settings` is largely as specified, with several UX refinements. Partner/admin targeting UI is mostly as specified, with countries using a scroll list instead of pills.

---

## 1. Scoring engine — major deviations from Prompt 1

### Demographics: penalties, not exclusions

**Plan (Prompt 1):** Demographic targeting **excludes** books from the carousel when the reader does not match partner targets. A `meetsConstraints(book, profile, relaxLevel)` function progressively relaxes constraints (country → gender → age) until `MIN_CAROUSEL_SLOTS` (3) are filled.

**Implemented:** No exclusion logic. No `meetsConstraints`, no `relaxLevel`, no progressive relaxation in `rankFeaturedBooks`.

Demographics work as **weighted bonuses and penalties** (Prompt 2 model):

- Partner sets target age/gender/country arrays on the book.
- If the reader has a value for that field and it **matches** → add bonus (`scoreGenderMatch`, `scoreAgeMatch`, `scoreCountryMatch`).
- If the reader has a value and it **does not match** → subtract penalty (`penaltyGenderMismatch`, etc.).
- If partner left the target array **empty** → no demographic signal (0).
- If the reader **has not set** that profile field (null) → no demographic signal (0), same intent as the plan.

**Manual implication:** Books are never hidden from the featured pool because of demographics. Mismatches reduce score but do not remove the book. There is no "carousel thinning" or automatic constraint relaxation at runtime.

### `minCarouselSlots`

**Plan:** `MIN_CAROUSEL_SLOTS = 3` drives graceful degradation.

**Implemented:** `minCarouselSlots` exists in `FeaturedScoringConfig` / `FeaturedScoringHistory` and in `DEFAULT_SCORING_WEIGHTS`, but it is **not used** in the scoring engine or ranking. It is also **not exposed** in the admin weight UI (only the four visible groups: Genre, Recency, Bonuses, Penalties).

### Featured book pool — no `Book.isFeatured`

**Plan (Prompt 1 rollout notes):** "`isFeatured` on `Book` remains the entry gate."

**Implemented:** `Book` has **no** `isFeatured` field. `isFeatured` exists only on `GeneratedImage` (gallery images).

Featured carousel pool selection:

1. Query top **20** published books by library popularity (`userBooks` count).
2. Score and rank those for the logged-in user.
3. Return top **5** for the carousel.

Guests get the top 5 by popularity with no scoring.

**Manual implication:** Any published book with a cover can enter the pool if popular enough. Partners/admins do not toggle "featured book" on the book record.

### Library signal — richer than planned

**Plan (Prompt 1):** Flat `libraryGenres: string[]`, one weight per match, cap of 3.

**Implemented:** `libraryBooks: LibraryBookEntry[]` per reader, each with:

- Genre
- Progress: `not_started` | `in_progress` | `more_than_halfway`
- Added recency: `recent` | `stale` (threshold from `libraryRecencyDays`, default 90)

Different weights apply per state (`scoreLibraryDeep`, `scoreLibraryStarted`, `scoreLibraryRecentUnread`, `scoreLibraryStaleUnread`), capped by `libraryMatchCap`.

Production profile is built in `lib/discover-scoring-profile.ts` from `UserBook`, `ReadingProgress`, and chapter counts.

### Recency scoring

Matches the plan in spirit: partner uploads only (`isPublicDomain` → 0), tiered by `recencyFreshDays` / `recencyRecentDays` / `recencyWarmDays` and corresponding score weights. Admin test scenario uses an upload-age select ("Within 7 days", etc.) rather than a date picker.

### All weights are DB-backed and tunable

Hardcoded constants were moved to `FeaturedScoringConfig` with 60-second cache (`getScoringWeights()`). Engine functions take a `ScoringWeights` argument.

---

## 2. Discover page & routing

**Plan:** References `/books` and `app/(public)/books/`.

**Implemented:**

- Catalogue lives at **`/discover`**; `/books` redirects to `/discover`.
- `getDiscoverFeaturedBooks(userId, limit)` is called from the discover server component with the current user's DB id (or `null` for guests).
- Return type to the UI is still `DiscoverCatalogueBook[]` — scores and `isPersonalised` are **not** passed to the carousel component (internal only).

**Manual implication:** Document Discover, not Books, for the featured carousel.

---

## 3. Profile option constants

**Plan:** `lib/user-profile-options.ts` defines inline values like `"18-24"`, `"under-18"`, etc.

**Implemented:** `lib/user-profile-options.ts` **re-exports** from existing libs:

- `AGE_RANGES` ← `lib/age-range.ts` (Prisma values: `EIGHTEEN_24`, `TWENTY5_34`, …)
- `GENDERS` ← `lib/gender.ts` (Prisma `Gender` enum)
- `GENRE_OPTIONS` ← `lib/genre.ts`

Onboarding, partner targeting, admin test scenario, and validation all use these. Manual must show **Prisma enum values**, not the hyphenated strings from the plan doc.

---

## 4. Partner & admin targeting UI

### Mostly as planned

- Section title pattern: "Audience targeting" (monospace eyebrow).
- Age, gender, additional genres: **`MultiSelectPills`**.
- Auto-save debounced 800ms via `PATCH /api/partner/books/[id]/targeting`.
- Partner view: hidden for **public-domain** books.
- Admin view: shown for **all** books, with `showPreview` and "Editing targeting" label.
- Admin preview API: `GET /api/admin/books/[id]/targeting-preview`.

### Countries — UI change

**Plan:** Searchable **multi-select pills** for countries.

**Implemented:** **`MultiSelectListbox`** (`components/ui/multi-select-listbox.tsx`) — searchable scroll box with checkboxes, "N selected", and Clear. Used in:

- Partner/admin `BookAudienceTargeting`
- Admin featured-settings test book ("Target countries")

Age/gender/genres remain pills.

### Targeting preview — partial alignment with live scoring

Preview still uses a **strict demographic filter** for "estimated combined reach" (`strictDemographicWhere` at relaxLevel 0 style: users with null demographic fields still count via `OR { field: null }`).

That preview logic does **not** mirror live carousel ranking (which uses penalties, not exclusion). Manual should say preview is an **approximate audience-size estimate**, not "who will see this book in the carousel."

Per-field counts only include readers who **have** the field set and match (not null-pass-through).

---

## 5. Admin page `/admin/featured-settings`

Nav entry: **"Featured scoring"** under Admin Helpers (`/admin/featured-settings`).

### Four sections — present, with UX differences

| Section | Plan | Implemented |
|--------|------|-------------|
| Live weights | Full labels, 2–3 col grid, amber custom border | **Short labels** + `title` tooltip with full name; **narrow** numeric inputs (~3 digits); dense auto-fill grid; **accent** left border when customised |
| Radar preview | Chart then table below | **Side by side** on large screens (chart left, raw scores right) |
| Test scenario | Pills for countries | **Listbox** for countries; local `PillToggle` for other multi-selects (not shared `MultiSelectPills`) |
| History calendar | As specified | As specified (`react-calendar`, dots, diff, restore) |

### Weight field labels (admin UI)

Short labels in the form; full names on hover. Examples:

- `Genre pref` → "Genre preference match"
- `Lib - Deep` → "Library deep read (>50% progress)"
- `Gender penalty` → "Gender mismatch penalty"

History diff/snapshot views still use **full** labels.

### `minCarouselSlots`

In DB and API, **not** in the admin weight form.

### Save / Publish

Both **Save weights** (Section 1) and **Publish weights** (Section 3) open the **same** confirmation modal and POST the **live weight inputs** from Section 1. Test scenario fields are reader/book data only — correct per plan.

Success feedback is inline **"Saved ✓"**, not a toast.

### Restore flow

Restore fills **live weight inputs**, shows snapshot banner in the test scenario section, updates radar, scrolls to live weights. Editing live weights also clears the snapshot banner (plan only mentioned test-field edits).

### Radar chart normalization — important for manual

Axes show **0–100 normalized** scores, not raw values. Raw values are in the adjacent table.

Scale:

- **50** = neutral (0 raw)
- **100** = maximum positive for that dimension
- **0** = maximum penalty for that dimension

A bug was fixed: full penalty (e.g. gender −40 with `penaltyGenderMismatch: 40`) previously plotted at **100%**; it now plots at **0%**.

Polygons: solid accent = live weights; dashed grey = defaults (same test scenario).

### Technical note (not user-facing)

`DEFAULT_SCORING_WEIGHTS` and types live in `lib/featured-scoring-weights.ts` (client-safe). `lib/featured-scoring-config.ts` is server-only (Prisma). Client components must not import the config module directly.

---

## 6. API & data model — aligned with plan

Implemented as specified:

- `FeaturedScoringConfig` (singleton) + `FeaturedScoringHistory`
- `GET/POST /api/admin/featured-scoring/config`
- `GET /api/admin/featured-scoring/history?year=&month=`
- Four `Book.featuredTarget*` array fields
- `PATCH /api/partner/books/[id]/targeting`
- Cache invalidation on save; ~60s propagation called out in confirm modal

Minor implementation detail: Prisma is imported via `@/lib/prisma` in many files; plan text says `@db` alias.

---

## 7. What the manual should **not** say (obsolete from plans)

- Books are excluded from the carousel when demographics don't match.
- `relaxLevel` progressive relaxation (country → gender → age).
- Admins toggle `Book.isFeatured` to enter the featured pool.
- Featured carousel lives on `/books`.
- Age/gender option values use strings like `"18-24"` / `"under-18"`.
- Country targeting uses pill buttons everywhere.
- `minCarouselSlots` is adjustable in the admin UI or affects live ranking today.
- Radar chart axis values are the same numbers as the raw score table.

---

## 8. What the manual **should** say (accurate behaviour)

1. **Featured carousel** on `/discover` shows up to 5 books from a popularity pool of 20, re-ordered by personalised score when logged in.
2. **Guests** see popularity order only.
3. **Partners** set audience targeting on non–public-domain book detail; empty fields mean "no restriction."
4. **Demographic mismatch** lowers score; it does not hide the book.
5. **Admins** tune weights at `/admin/featured-settings`, preview with test reader/book + radar, and review history/restore.
6. **Weight changes** apply site-wide within about 60 seconds (cache TTL).
7. **Library engagement** (started, deep read, unread recency) affects score with separate weights.
8. **Public-domain books** get no recency boost.
9. **Targeting preview** on admin book detail is approximate reach sizing, not exact carousel behaviour.

---

## 9. Related discover UX changes (same project, separate from scoring plans)

If the manual covers Discover broadly:

- `/books` removed; use `/discover`.
- Community visions gallery scoped to the **selected** featured book.
- "Start Reading" / `?book=` on library adds the book to the shelf.
- Various layout/copy tweaks on discover (genre pills, CTAs, book description in featured panel).

---

## Key source files

| Area | Files |
|------|-------|
| Scoring engine | `lib/featured-book-scoring.ts` |
| Weights (client-safe) | `lib/featured-scoring-weights.ts` |
| Weights (server/cache) | `lib/featured-scoring-config.ts` |
| Radar normalization | `lib/scoring-radar.ts` |
| Discover integration | `lib/discover-catalogue.ts`, `lib/discover-scoring-profile.ts` |
| Admin UI | `app/admin/featured-settings/` |
| Targeting UI | `components/partner/book-audience-targeting.tsx` |
| Country listbox | `components/ui/multi-select-listbox.tsx` |
| Profile options | `lib/user-profile-options.ts` |
