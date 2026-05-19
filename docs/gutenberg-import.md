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

All three load **`.env` then `.env.local`** via `scripts/lib/load-env.ts`.

---

## Before you start

1. **Database** — `DATABASE_URL` in `.env` or `.env.local` (Neon).
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

Calls Gutendex for up to **1000** popular English titles, applies accept / review / reject filters, and writes **`scripts/gutenberg-queue.json`** (gitignored).

**EPUB choice:** Gutendex usually lists only the large illustrated EPUB3. Fetch stores the **no-images** EPUB URL (`/ebooks/{id}.epub.noimages`) for ingest — text only, under the size cap. Covers still come from the Gutendex JPEG / Open Library.

| Flag | Meaning |
|------|---------|
| `--delta` | Skip titles whose `gutenbergId` is already in the database |
| `--verbose` | Log reject and review reasons per title |

Expect several minutes (300ms delay between Gutendex pages).

---

## Step 2 — Review and approve

1. Open **http://localhost:3000/admin/gutenberg-import**
2. Browse **Accepted**, **Needs review**, and **Rejected**
3. Check the titles you want (accepted entries are checked by default)
4. Click **Queue approved books**

Ingest **only** processes approved rows.

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
```

| Flag | Meaning |
|------|---------|
| `--limit N` | Process only the first N approved books |
| `--resume` | Skip `gutenbergId`s already in the database, and titles flagged for manual upload |
| `--dry-run` | No database or Cloudinary writes |

**Per book**, ingest will:

- Resolve **Open Library metadata + cover** (then create the `Book` row with those fields)
- Download the EPUB from Project Gutenberg
- If EPUB is **larger than 4.5 MB**, flag the queue entry for **manual upload** (skipped on future `--resume` / `--limit` runs)
- Parse chapters, chunk text, and create embeddings (OpenAI)
- Set status to **`pending_review`**, or **`draft`** with no chunks if genre detection fails

A **2 second** pause runs between books.

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
| Queue, approvals, manual-upload flags | `/admin/gutenberg-import` |
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

## Common errors

| Message | What to do |
|---------|------------|
| `Queue file not found` | `npm run gutenberg-fetch` |
| `No approved entries` | Approve on `/admin/gutenberg-import` |
| `DATABASE_URL is not set` | Add to `.env.local` |
| `GUTENBERG_ADMIN_USER_ID must be a valid admin` | Set to admin `User.id` |
| `EPUB exceeds 4.5MB` / `Too large` in summary | Flagged on the queue for manual upload; see **Manual upload required** on `/admin/gutenberg-import` |
| `No Open Library match` | Book still ingests; may have Gutendex cover only |
| Cover errors / local `covers.openlibrary.org` timeout | Ingest uses Cloudinary fetch; verify `CLOUDINARY_URL` |
| Partial success (e.g. 4 ok, 1 failed) | Check `Failed gutenbergIds` in summary |

---

## Related files

| Path | Role |
|------|------|
| `scripts/gutenberg-fetch.ts` | Gutendex discovery |
| `scripts/gutenberg-ingest.ts` | Full ingest (includes OL enrichment) |
| `scripts/gutenberg-enrich.ts` | Optional backfill / cover refresh |
| `lib/open-library.ts` | OL search + work metadata |
| `lib/open-library-cover.ts` | Unified metadata + cover resolution |
| `scripts/lib/load-env.ts` | Env loading for CLI scripts |
| `app/admin/gutenberg-import/` | Review UI |
