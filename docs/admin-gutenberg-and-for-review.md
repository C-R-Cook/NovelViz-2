# Gutenberg import, admin Helpers, and For review

Operator guide for how Project Gutenberg books enter NovelViz, what each admin **Helper** does, and exactly how the **For review** moderation queue works in the dashboard.

For CLI flags, deferred-queue mechanics, and error troubleshooting, see also [`gutenberg-import.md`](./gutenberg-import.md).

---

## Two pipelines, one moderation gate

Most catalogue books arrive either from **Gutenberg bulk import** or from **partner/admin EPUB upload**. Both run the same chapter → chunk → embedding pipeline and land in **`pending_review`** until an admin approves them.

```
  Gutenberg CLI                    Partner / admin upload
  ─────────────────                  ──────────────────────
  gutenberg-fetch                    POST /api/admin/books/[id]/ingest
       │                                    │
       ▼                                    ▼
  gutenberg-queue.json              (same ingest core)
       │                                    │
  Admin approves on                         │
  /admin/gutenberg-import                   │
       │                                    │
       ▼                                    ▼
  gutenberg-ingest ──────────────► Book.status = pending_review
                                           │
                                           ▼
                              Dashboard → For review tab
                              (/dashboard?tab=for-review)
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     ▼                     ▼                     ▼
               published            unlisted               rejected
                     │                     │                     │
                     ▼                     ▼                     ▼
            Discover (listed)    Discover (hidden)    Partner sees reason;
            if cover present       partner choice       internal notes updated
```

**Discover** (`/discover`) shows only **`published`** books with a **cover image**.

---

## Gutenberg import (current behavior)

### npm scripts

| Command | Script | Purpose |
|---------|--------|---------|
| `npm run gutenberg-fetch` | `scripts/gutenberg-fetch.ts` | Build / refresh `scripts/gutenberg-queue.json` from Gutendex |
| `npm run gutenberg-ingest` | `scripts/gutenberg-ingest.ts` | Ingest approved queue rows → DB |
| `npm run gutenberg-enrich` | `scripts/gutenberg-enrich.ts` | Repair metadata / covers / descriptions on existing rows |
| `npm run gutenberg-park-deferred` | `scripts/gutenberg-park-deferred.ts` | Move blocked titles to `gutenberg-queue-deferred.json` |

All four load **`.env` then `.env.local`** via `scripts/lib/load-env.ts`.

### Step 1 — Discovery (`gutenberg-fetch`)

- Calls Gutendex: `https://gutendex.com/books?languages=en&sort=popular` until **1000** titles (300ms between pages).
- For each title, runs **`classifyBook(subjects, bookshelves, title)`** in `scripts/lib/gutenberg-filters.ts`.
- Resolves **`gutenbergSummary`** per row via **`resolveGutenbergCatalogDescription`** (Gutendex `summaries[0]`, else scrape `gutenberg.org/ebooks/{id}` with 400ms throttle when scrape is needed).
- Writes **`scripts/gutenberg-queue.json`** (gitignored).

| Flag | Effect |
|------|--------|
| `--delta` | Skip `gutenbergId`s already in the database |
| `--verbose` | Log per-title reject/review/scrape details |

#### Discovery filters

**Order of evaluation**

1. **Title hard-reject** (case-insensitive substring in Gutendex **title**). Reason stored as `title: <term>`.

   - `poems`
   - `collection of`
   - `translated into english`
   - `essays`
   - `library of`
   - `encyclopaedia` / `encyclopedia`
   - `works of`
   - `stories`

2. **Subject/bookshelf hard-reject** — medicine, law, engineering, cookery, etc. (full list in `HARD_REJECT_TERMS` in `gutenberg-filters.ts`).

3. **Soft review** — history, biography, poetry (subjects), religion, etc. (`SOFT_REVIEW_TERMS`). Exception: `folklore`, `mythology`, `drama` auto-accept.

| `filterResult` | Meaning in UI |
|----------------|---------------|
| `accepted` | Default checked on import queue; ready to approve for ingest |
| `review` | “Needs review” tab — borderline subjects |
| `rejected` | “Rejected” tab — excluded from bulk ingest |

**EPUB URL:** `pickEpubUrl()` prefers Gutendex **no-images** EPUB; if only illustrated EPUB3 is listed, stores derived `https://www.gutenberg.org/ebooks/{id}.epub.noimages`. `epubUrl: null` when Gutendex has no EPUB.

### Step 2 — Queue approval (browser)

**URL:** `/admin/gutenberg-import` (tabs via `?tab=` — see [Gutenberg admin nav](#gutenberg-admin-navigation))

1. Review **Accepted**, **Needs review**, **Rejected**, **Deferred**, **Flagged**.
2. Check titles to ingest (accepted entries default checked).
3. **Queue approved books** — sets `approved: true` on selected rows in `gutenberg-queue.json` (via API).

**Ingest only runs** rows with `approved: true` that are **not** in the deferred file.

### Step 3 — Ingest (`gutenberg-ingest`)

Requires `DATABASE_URL`, `OPENAI_API_KEY`, `CLOUDINARY_URL`, `GUTENBERG_ADMIN_USER_ID` (admin `User.id` for book ownership).

Per approved book:

1. Skip if `gutenbergId` already in DB.
2. If no `epubUrl` → **park** to deferred (`no_epub`), remove from active queue.
3. Download EPUB (120s timeout).
4. If EPUB **> 4.5 MB** → **park** (`epub_too_large`).
5. **`resolveGutenbergBookEnrichment`** — description (PG summary → OL), cover (EPUB → Gutendex JPEG → OL via Cloudinary), `openLibraryKey`, `publishedYear`.
6. Parse chapters, chunk, embed (OpenAI genre + embeddings).
7. Set **`pending_review`** (or **`draft`** if genre classification fails — `[SKIP-GENRE]`).

2s pause between books. Outcomes: succeeded, deferred, failed (stays on queue for `--resume`), skipped (already in DB).

### Catalogue descriptions (canonical)

**Always use** `resolveGutenbergCatalogDescription(gutenbergId, summaries)` from `lib/gutenberg-page-summary.ts`:

1. Gutendex `summaries[0]` — strip `(This is an automatically generated summary.)`
2. Scrape live ebook page — `.summary-text-container` (current PG layout), legacy `<p>` fallback
3. At call sites after that: Open Library → EPUB OPF → subject blurb (`pickBestDescription`)

**Scrape repair** for bad descriptions on pending-review books:

```bash
npm run gutenberg-enrich -- --gutenberg-summaries --status pending_review
```

Eligible when description is empty, starts with `in published order`, starts with `Public domain classic. Subjects:`, or **starts with** Gutenberg search chrome (`X` then `Go!`, including long page scrapes). See `isDescriptionEligibleForGutenbergSummaryBackfill` in `lib/book-description.ts`.

### Step 4 — Publish

Gutenberg-ingested books are **`pending_review`**, not published automatically. Use **For review** (below) or `/admin/books/[id]` → Publish.

### Queue files (gitignored)

| File | Role |
|------|------|
| `scripts/gutenberg-queue.json` | Active discovery queue |
| `scripts/gutenberg-queue-deferred.json` | Parked: `no_epub`, `epub_too_large` |

### Gutenberg admin navigation

Defined in `lib/gutenberg-admin-nav.ts`:

| Link | URL | Purpose |
|------|-----|---------|
| Import queue | `/admin/gutenberg-import` | Overview + approve for ingest |
| Deferred | `?tab=deferred` | Manual / blocked titles |
| Needs review | `?tab=review` | Borderline discovery |
| Accepted | `?tab=accepted` | Ready to queue |
| Publish | `/admin/books` | Legacy list filter (not the dashboard For review queue) |

**API:** `GET/PATCH /api/admin/gutenberg-queue` — read queue, approve entries, restore deferred.

---

## Admin Helpers

Helpers are grouped under **Helpers** in the top nav and admin dashboard sidebar (`lib/admin-helpers-nav.ts`, `components/admin/admin-helpers-nav.tsx`). Gutenberg import remains under its own nav group (`lib/gutenberg-admin-nav.ts`).

| Helper | URL | What it does |
|--------|-----|----------------|
| **Cover refresh** | `/admin/cover-refresh` | Lists **`pending_review`** books whose cover URL looks like the generic Project Gutenberg cache JPEG. Scans Open Library for a better cover; apply uploads via Cloudinary. API: `GET/POST /api/admin/cover-refresh`. |
| **Bulk chapter delete** | `/admin/chapters/bulk-delete` | Search **`pending_review`** books for chapters whose **title** contains a phrase; bulk-delete matching chapters across up to 25 books per run. Does not delete every chapter on a book (at least one must remain per book). API: `GET/POST /api/admin/chapters/bulk-delete`. Logic: `lib/admin-bulk-chapter-delete-pending.ts`. |
| **Gutenberg import** | `/admin/gutenberg-import` | Discovery queue UI (see above). |
| **Data flows** | `/admin/data-flows` | Read-only Mermaid diagrams of ingest, AI, and moderation pipelines (`lib/admin-data-flows.ts`). |
| **T2I tester** | `/admin/t2i-tester` | Compare fal.ai image models; writes local files under project output paths (`lib/t2i-local-output.ts`). |

Per-book chapter tools live on **`/admin/books/[id]`** (not under Helpers): **Chapter Manager** → **Editor** (single chapter: merge, raw text) and **Bulk edit** (rename titles and/or delete selected, `POST /api/admin/books/[id]/chapters/bulk-delete`).

---

## For review system (exact behavior)

### Where it lives

| Surface | URL / component |
|---------|-----------------|
| Primary queue | Dashboard → **For review** tab — `/dashboard?tab=for-review` |
| Tab slug | `for-review` (`lib/dashboard-tab.ts`) |
| Queue UI | `app/(reader)/(app)/dashboard/for-review-queue.tsx` |
| Shell | `app/(reader)/(app)/dashboard/dashboard-client.tsx` |
| Book detail | `/admin/books/[id]?returnTo=/dashboard%3Ftab%3Dfor-review` (default return from `lib/admin-book-navigation.ts`) |
| Legacy list | `/admin/books?filter=pending_review` — same books, table UI |

**Access:** admin role only (dashboard loads `loadAdminDashboardData` when user is admin).

### What “for review” means in the database

A book is in the queue when:

- `Book.status === 'pending_review'`
- `Book.deletedAt === null`

Sources include Gutenberg ingest, partner **Submit for review** (`draft` → `pending_review`), and admin ingest on draft/published/unlisted books.

### Initial page load

`app/(reader)/(app)/dashboard/page.tsx` calls `loadAdminDashboardData()` (`lib/dashboard-data.ts`), which always loads:

| Field | Query |
|-------|--------|
| `pendingBooks` | First **50** (`FOR_REVIEW_QUEUE_PAGE_SIZE`) `pending_review` books, `orderBy: updatedAt desc` |
| `pendingReviewCount` | Total count of `pending_review` non-deleted books |
| KPI `liveBooksCount` | `published` + non-deleted (overview tab) |

Only id, title, author, cover, `listingPreferenceAfterReview` are sent to the client for the queue rows.

### Sidebar badge

Nav item **For review** shows badge count = `pendingReviewCount` (total in DB, not just loaded rows).

### Queue display modes

**Default list** — uses `pendingBooks` from server + client “load more”.

**Search** — typing in “Search by title or author…” (300ms debounce) calls:

```
GET /api/admin/books?filter=pending_review&skip=0&take=50&sort=updatedAt&dir=desc&q=<query>
```

While search is active, the UI shows API results only (not merged with the loaded “load more” pages). Clearing search returns to the in-memory list.

### Pagination (“Load next 50”)

When **not searching**, if `pendingBooks.length < pendingReviewCount`:

```
GET /api/admin/books?filter=pending_review&skip=<current length>&take=50&sort=updatedAt&dir=desc
```

Appends unique rows client-side. After **Approve**, **Reject**, or **Delete**, the row is removed locally and `router.refresh()` runs. A `useEffect` keeps extra loaded pages when refresh returns a shorter server list (so the queue does not snap back to only the first 50).

### Row actions

Each row shows cover thumbnail, title, author, and four actions:

#### 1. Approve

- **Client:** `PATCH /api/admin/books/{id}/status` with `{ status: "published" }` **or** `{ status: "unlisted" }`.
- **Target status** comes from `listingPreferenceAfterReview` on the book row:
  - `null` or `"published"` → **published**
  - `"unlisted"` → **unlisted**
- Partners set this preference when submitting from **draft** (default **published**).
- **Server:** Clears `listingPreferenceAfterReview` when leaving `pending_review`. Clears `rejectionReason` on non-reject transitions.
- **Notification:** If previous status was `pending_review` and owner exists → `BOOK_APPROVED` to partner.
- Row removed from queue; dashboard refreshes.

#### 2. Reject

- Opens modal; requires **≥ 20 characters** reason.
- **Client:** `PATCH .../status` with `{ status: "rejected", rejectionReason: "<text>" }`.
- **Server:**
  - Sets `Book.rejectionReason`
  - Prepends **`REJECTION REASON: <text>`** to `Book.internalNotes` (`lib/book-rejection-notes.ts`); replaces prior top-level rejection block if re-rejecting
  - Clears `listingPreferenceAfterReview`
  - **Notification:** `BOOK_REJECTED` with reason snippet (partner)
- Row removed from queue.

> **Note:** The reject modal copy says “set the book back to draft”; the API sets status to **`rejected`**, not `draft`. Partners return to **draft** via **Resubmit** on the partner book page.

#### 3. Delete

- Confirm dialog.
- **`DELETE /api/admin/books/{id}`** — soft-delete (`deletedAt` set); book leaves catalogue and queue.
- Row removed locally; refresh.

#### 4. Details

- Link to **`/admin/books/[id]`** with `returnTo` preserving the dashboard tab.

### Book detail page (`/admin/books/[id]`)

Same moderation outcomes with more tooling:

| Action | When visible | Behavior |
|--------|----------------|----------|
| **Reject** | `status === pending_review` | Same modal + API as dashboard; redirects to `returnTo` after success |
| **Publish** | Not `processing` | Saves dirty metadata first if needed; sets `published` or `unlisted` from `listingPreferenceAfterReview` when coming from `pending_review` |
| **Chapter Manager** | Not `processing` | Edit titles, merge, single delete; **Bulk delete** tab for checkbox bulk delete |
| **Internal notes** | Always (metadata) | Shown in textarea; rejection reason prefixed block appears here after reject; older rejects may display merged text on load without DB write until save |

Status dropdown on detail can move between allowed admin statuses; ingest allowed for `draft`, `pending_review`, `published`, `unlisted`.

### Partner side (context)

| Transition | Rule |
|------------|------|
| `draft` → `pending_review` | Allowed; sets `listingPreferenceAfterReview` (published vs unlisted) |
| `pending_review` / `rejected` → `draft` | Allowed; clears listing preference; clears `rejectionReason` when leaving **rejected** |
| `rejected` | Partner sees `rejectionReason` on book page; can edit and resubmit as draft |

Partners do **not** use the dashboard For review tab.

### API reference (moderation)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `PATCH` | `/api/admin/books/[id]/status` | `{ status, rejectionReason? }` | Admin or owner; reject requires ≥ 20 char reason |
| `DELETE` | `/api/admin/books/[id]` | — | Soft delete |
| `GET` | `/api/admin/books` | `filter=pending_review`, `skip`, `take`, `sort`, `dir`, `q` | Paginated list + search |

### Status after moderation

| Action | New `Book.status` | Discover |
|--------|-------------------|----------|
| Approve (listed) | `published` | Visible if cover present |
| Approve (unlisted preference) | `unlisted` | Hidden from public catalogue |
| Reject | `rejected` | Hidden |
| Delete | (soft-deleted) | Hidden |

---

## Typical operator workflows

### New Gutenberg batch

```bash
npm run gutenberg-fetch -- --delta
# Review / approve at /admin/gutenberg-import
npm run gutenberg-ingest -- --resume
```

Then **`/dashboard?tab=for-review`** — approve, reject, fix chapters/covers via Helpers or book detail.

### Fix bad PG descriptions on pending queue

```bash
npm run gutenberg-enrich -- --gutenberg-summaries --dry-run
npm run gutenberg-enrich -- --gutenberg-summaries --status pending_review
```

### Strip junk chapters (e.g. “Contents”) across pending books

**Helpers → Bulk chapter delete** — search phrase, select books, delete.

---

## Related implementation index

| Area | Path |
|------|------|
| Gutenberg CLI runbook | `docs/gutenberg-import.md` |
| Discovery filters | `scripts/lib/gutenberg-filters.ts` |
| Queue types | `scripts/lib/gutenberg-types.ts` |
| Deferred queue | `scripts/lib/gutenberg-deferred.ts` |
| PG description + scrape | `lib/gutenberg-page-summary.ts`, `lib/book-description.ts` |
| OL enrichment | `lib/open-library-cover.ts` |
| Rejection → internal notes | `lib/book-rejection-notes.ts` |
| For review data | `lib/dashboard-data.ts`, `lib/admin-books-list.ts` |
| Helpers nav | `lib/admin-helpers-nav.ts` |
| Dashboard tab | `lib/dashboard-tab.ts` |
| Status API | `app/api/admin/books/[id]/status/route.ts` |
| For review UI | `app/(reader)/(app)/dashboard/for-review-queue.tsx` |
| Admin book UI | `app/admin/books/[id]/admin-book-detail-client.tsx` |
