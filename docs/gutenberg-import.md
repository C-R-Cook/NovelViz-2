# Gutenberg bulk import

How to discover public-domain books from Project Gutenberg (via [Gutendex](https://gutendex.com)), review them, ingest them into NovelViz, and publish them on Discover.

This pipeline is **not** `npx prisma db seed`. The Prisma seed only adds a handful of dev placeholder books.

---

## npm scripts

| Command | Script | Purpose |
|---------|--------|---------|
| `npm run gutenberg-fetch` | `scripts/gutenberg-fetch.ts` | Build / refresh the local discovery queue |
| `npm run gutenberg-ingest` | `scripts/gutenberg-ingest.ts` | EPUB ingest + **Open Library metadata & covers** |
| `npm run gutenberg-enrich` | `scripts/gutenberg-enrich.ts` | Optional backfill for books ingested **before** unified ingest |
| `npm run gutenberg-park-deferred` | `scripts/gutenberg-park-deferred.ts` | Move blocked titles (no EPUB / too large) into the deferred file |

All four load **`.env` then `.env.local`** via `scripts/lib/load-env.ts`.

---

## Queue files (gitignored)

| File | Role |
|------|------|
| `scripts/gutenberg-queue.json` | Active discovery queue — titles you review and approve for bulk ingest |
| `scripts/gutenberg-queue-deferred.json` | Parked / blocked titles — removed from the active queue so ingest does not retry them |

Copy these between machines if you want the same approvals and deferred list locally. They are **not** in git.

---

## Before you start

1. **Database** — `DATABASE_URL` in `.env` or `.env.local` (Neon). Large bulk ingests need enough **Neon storage** on your plan (Launch+); hitting the project size limit produces Postgres errors during chapter/embedding writes, not “EPUB too large”.
2. **Secrets** (typically in `.env.local`):
   - `OPENAI_API_KEY` — genre detection and embeddings (ingest only)
   - `CLOUDINARY_URL` — cover uploads (ingest; required for OL covers via remote fetch)
   - `GUTENBERG_ADMIN_USER_ID` — `User.id` of an admin (e.g. `dev_user_admin` after `npx prisma db seed`)
3. **Prisma client** — `npx prisma generate` if you have not run it since cloning.
4. **App running** for the review step — `npm run dev`, signed in as an **admin**.

### Quick connectivity check

```bash
curl "https://openlibrary.org/search.json?q=dracula&limit=1"
```

Cover art is loaded via **Cloudinary remote fetch** from `covers.openlibrary.org`, so your laptop does not need to reach the covers CDN directly.

---

## Pipeline overview

```
  1. Discovery (CLI)     →  scripts/gutenberg-queue.json
  2. Review (browser)    →  approved: true on queue entries
  3. Ingest (CLI)        →  EPUB + OL metadata + cover + embeddings
       │                      (blocked titles → deferred file)
  4. Publish (admin UI)  →  Discover (/books)
```

**You do not need a separate enrich step** for new imports. Ingest calls Open Library once per book and writes `openLibraryKey`, `description`, `publishedYear`, and `coverImageUrl` before chapter processing.

Use `gutenberg-enrich` only to repair older books. Use `--refresh-covers` if you explicitly want to prefer Open Library art over existing covers.

---

## Covers and metadata (during ingest)

Shared logic: **`lib/open-library-cover.ts`** → `resolveGutenbergBookEnrichment()`

| Step | What happens |
|------|----------------|
| 1 | One Open Library search per book (metadata) |
| 2 | **Cover:** image embedded in the Gutenberg EPUB when present |
| 3 | **Fallback cover:** Gutendex JPEG from the queue, then Open Library via Cloudinary |
| 4 | **Metadata:** `openLibraryKey`, `description`, `publishedYear` saved on the `Book` row |

---

## Step 1 — Discovery

```bash
npm run gutenberg-fetch
```

Calls Gutendex for up to **1000** popular English titles, applies accept / review / reject filters, and writes **`scripts/gutenberg-queue.json`**.

**EPUB URL in queue:** `pickEpubUrl()` prefers Gutendex’s **no-images** EPUB when available. If Gutendex only lists a large illustrated EPUB3 URL, fetch stores the derived **no-images** URL (`https://www.gutenberg.org/ebooks/{id}.epub.noimages`) so ingest stays under the size cap. Some titles have **no EPUB** in Gutendex at all (`epubUrl: null`).

| Flag | Meaning |
|------|---------|
| `--delta` | Skip titles whose `gutenbergId` is already in the database |
| `--verbose` | Log reject and review reasons per title |

Expect several minutes (300ms delay between Gutendex pages).

**New machine:** run `npm run gutenberg-fetch` (or copy `gutenberg-queue.json` from another machine). You do **not** need to re-fetch for ingest if the queue file is already populated.

---

## Step 2 — Review and approve

1. Open **http://localhost:3000/admin/gutenberg-import**
2. Browse **Accepted**, **Needs review**, **Rejected**, and (when present) **Deferred**
3. Check the titles you want (accepted entries are checked by default)
4. Click **Queue approved books**

Ingest **only** processes rows in `gutenberg-queue.json` with `approved: true` that are **not** in the deferred file.

### Admin UI sections

| Section | Meaning |
|---------|---------|
| **Accepted / Needs review / Rejected** | Discovery filters from fetch |
| **Deferred (manual / blocked)** | Titles parked in `gutenberg-queue-deferred.json` — filter by **No EPUB** or **Too large**; **Restore to queue** moves back for re-review (not auto-approved) |
| **Still flagged (not parked yet)** | Too-large flags still on the active queue — run `npm run gutenberg-park-deferred` to move them |

---

## Step 3 — Ingest

### Dry run

```bash
npm run gutenberg-ingest -- --dry-run --limit 1
```

### Real ingest

```bash
npm run gutenberg-ingest -- --limit 5
npm run gutenberg-ingest
npm run gutenberg-ingest -- --resume
```

| Flag | Meaning |
|------|---------|
| `--limit N` | Process only the first N **remaining** approved books (after resume / skip filters) |
| `--resume` | Skip `gutenbergId`s already in the database; skip titles with `skipAutoIngest` on the active queue |
| `--dry-run` | No database, Cloudinary, or queue/deferred file writes |

**Per book**, ingest will:

1. Skip if `gutenbergId` already exists in the DB (`[SKIP]`).
2. If **no `epubUrl`** — **park** to deferred (`no_epub`), remove from active queue, do not count as a hard failure.
3. Download EPUB from Project Gutenberg (120s timeout).
4. If EPUB is **larger than 4.5 MB** — **park** to deferred (`epub_too_large`), record size, remove from active queue.
5. Resolve **Open Library metadata + cover**, create `Book` row.
6. Parse chapters, chunk text, create embeddings (OpenAI).
7. Set status to **`pending_review`**, or **`draft`** with no chunks if genre classification fails (`[SKIP-GENRE]`).

A **2 second** pause runs between books. On success, `ingestedAt` is set on the queue entry (until the row is parked or removed).

### Ingest outcome summary

At the end of a run you will see counts for:

| Outcome | Meaning |
|---------|---------|
| **Succeeded** | Full ingest; book in DB as `pending_review` (or `draft` if skip-genre) |
| **Deferred** | Parked to `gutenberg-queue-deferred.json` (no EPUB or too large) |
| **Too large** | Same as deferred for size (listed separately in the summary) |
| **Failed** | Error after starting (e.g. network `fetch failed`, Neon storage limit) — **stays on active queue** for `--resume` retry |
| **Skipped** | Already in DB |
| **Skip genre** | Left as `draft`, no chunks |

**Not auto-parked:** transient download/network failures (`fetch failed`). Re-run `--resume` later; many succeed on a second pass. To bulk-park other cases, use the deferred tools below only for **no EPUB** and **too large** today.

### Cleaning the active queue after a messy run

Wait for any running ingest to finish, then:

```bash
npm run gutenberg-park-deferred
```

Options:

| Flag | Parks |
|------|--------|
| *(none)* | Approved **no EPUB** + active-queue **too-large** flags |
| `--no-epub` | Approved rows with `epubUrl: null` only |
| `--too-large` | Rows with `skipAutoIngest` / manual-upload flag only |
| `--all` | Both of the above |

Then:

```bash
npm run gutenberg-ingest -- --resume
```

---

## Deferred queue (blocked titles)

Titles that cannot auto-ingest are stored in **`scripts/gutenberg-queue-deferred.json`** and **removed** from `gutenberg-queue.json`, so bulk ingest does not retry them every run.

| `deferReason` | When |
|---------------|------|
| `no_epub` | Gutendex had no EPUB; ingest parks automatically |
| `epub_too_large` | Downloaded file over 4.5 MB; ingest parks automatically |

Each deferred row keeps full queue metadata (title, author, subjects, optional `epubUrl`, `epubSizeBytes` for too-large) plus `deferredAt`.

**Manual upload workflow:**

1. Upload EPUB via **http://localhost:3000/admin/books** (match title / set `gutenbergId` if needed).
2. Leave the title in **Deferred** until done, or **Restore to queue** only if you want it back in discovery for re-approval.

**During ingest:** parking writes both queue files immediately (not only at end of run).

---

## Optional — `gutenberg-enrich` (backfill only)

For books imported **before** unified ingest, or to refresh covers without re-ingesting EPUBs:

```bash
# Metadata + OL cover (rows with openLibraryKey still null)
npm run gutenberg-enrich

# Prefer Open Library covers over existing ones (optional upgrade path)
npm run gutenberg-enrich -- --refresh-covers
```

| Flag | Meaning |
|------|---------|
| `--refresh-covers` | Books with `openLibraryKey` + `gutenbergId`; tries **Open Library cover before** Gutendex |
| `--limit N` | Cap how many books to process |
| `--dry-run` | Log only |

---

## Step 4 — Publish on Discover

1. Open **http://localhost:3000/admin/books** (filter: `pending_review`)
2. Confirm chapters, cover, and metadata
3. Set status to **published**

Discover (**/books**) requires **published** status and a **cover image**.

---

## Where to see results

| Stage | Where |
|-------|--------|
| Active queue, approvals | `/admin/gutenberg-import` |
| Deferred / blocked titles | `/admin/gutenberg-import` → **Deferred** |
| Ingested / pending books | `/admin/books` → `/admin/books/[id]` |
| Public catalogue | `/books` (after publish) |

---

## Later batches

```bash
npm run gutenberg-fetch -- --delta
```

Review on `/admin/gutenberg-import`, then:

```bash
npm run gutenberg-ingest -- --resume
```

---

## Working while ingest runs

Safe: editing app UI, most of the codebase, running `npm run dev`.

Avoid: a **second** `gutenberg-ingest`, **Prisma migrations**, or hand-editing `gutenberg-queue.json` while ingest is running (the CLI rewrites the queue/deferred files). Restart dev server after changing `.env.local` only affects **new** processes.

---

## Common errors

| Message | What to do |
|---------|------------|
| `Queue file not found` | `npm run gutenberg-fetch` (or copy queue from another machine) |
| `No approved entries` | Approve on `/admin/gutenberg-import` |
| `DATABASE_URL is not set` | Add to `.env.local` |
| `GUTENBERG_ADMIN_USER_ID must be a valid admin` | Set to admin `User.id` |
| `No EPUB URL — parking to deferred` | Normal; title moved to deferred file |
| `EPUB exceeds 4.5MB` / **Too large** in summary | Parked to deferred; upload manually |
| `could not extend file` / **512 MB** (Neon) | Upgrade Neon storage or delete data; failed book is rolled back; retry with `--resume` after space available |
| `fetch failed` | Transient Gutenberg/network error; **not** parked — retry `--resume` |
| `EPUB download failed: 404` | Bad URL; may need manual EPUB or defer after fixing queue |
| `No Open Library match` | Book still ingests; may have Gutendex cover only |
| Cover errors | Verify `CLOUDINARY_URL` (ingest uses Cloudinary remote fetch) |
| `[SKIP-GENRE]` | Book saved as `draft` without chunks; fix genre rules or ingest manually |
| Partial success | Check `Failed gutenbergIds` vs `Deferred gutenbergIds` in summary |

---

## Related files

| Path | Role |
|------|------|
| `scripts/gutenberg-fetch.ts` | Gutendex discovery |
| `scripts/gutenberg-ingest.ts` | Full ingest (includes OL enrichment + deferred parking) |
| `scripts/gutenberg-park-deferred.ts` | Bulk-park blocked titles on active queue |
| `scripts/gutenberg-enrich.ts` | Optional backfill / cover refresh |
| `scripts/lib/gutenberg-types.ts` | Queue + defer reason types |
| `scripts/lib/gutenberg-deferred.ts` | Read/write/park/restore deferred file |
| `scripts/lib/gutenberg-queue-flags.ts` | Manual-upload flags + labels |
| `scripts/lib/gutenberg-filters.ts` | Accept/reject filters + `pickEpubUrl` |
| `scripts/lib/load-env.ts` | Env loading for CLI scripts |
| `lib/open-library.ts` | OL search + work metadata |
| `lib/open-library-cover.ts` | Unified metadata + cover resolution |
| `app/admin/gutenberg-import/` | Review + deferred UI |
| `app/api/admin/gutenberg-queue/route.ts` | Queue API (includes `deferred`, `restoreDeferred`) |
