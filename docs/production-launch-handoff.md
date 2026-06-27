# Production launch handoff — catalogue, Cloudinary, and site polish

This document captures work done to move NovelViz from **beta** toward **general availability**: separating dev and production assets, promoting the admin catalogue to production, cleaning up test gallery data, and aligning marketing copy and site chrome (footer, sign-up).

**Audience:** developers, operators, and anyone onboarding to the project who needs both the *why* (product) and the *how* (commands, code paths, pitfalls).

**Related docs:**

- [Database environments (Neon + Vercel + local)](./database-environments.md) — env vars, branches, Cloudinary folder summary
- [Sign-up and onboarding](./sign-up-onboarding.md) — registration flow after beta
- [Gallery system](./gallery-system.md) — Imagine uploads and public gallery behaviour
- [Book cover AI generation](./book-cover-ai-generation.md) — Cover AI vs user covers
- [Project overview](../ref_docs/novelviz-project-overview.md) — product context, stack, and documentation index

---

## Executive summary

| Area | Creative / product intent | Technical outcome |
|------|---------------------------|-------------------|
| **Launch positioning** | NovelViz is no longer a closed beta; sign-up is open to everyone. | Landing nav CTA changed from “Join Beta →” to **Sign Up →**; beta email capture section removed. |
| **Trust & consistency** | Legal links and brand should feel the same everywhere, including for guests. | Single **`PublicFooter`** in root layout; shown on almost all routes (hidden only in immersive `/reader/*`). |
| **Data isolation** | Dev experiments must not overwrite or confuse production catalogue and media. | Neon **development** vs **production** branches; Cloudinary paths under `novelviz/dev/` and `novelviz/prod/`. |
| **Production catalogue** | Live Discover should offer the same public-domain library the team curated on dev. | **`promote-catalogue-dev-to-prod`** script copies books, chapters, embeddings, and **covers** from dev → prod. |
| **Gallery / Imagine** | Test images are disposable; a clean prod start is acceptable. | Gallery assets are **not** part of catalogue promotion; use **`cleanup-gallery-images`** to delete Cloudinary + DB together. |

---

## Part 1 — Product and creative decisions

### End of beta messaging

**Before:** The landing page invited users to “Join Beta”, included a “Now in Beta” section with email capture, and implied limited early access.

**After:** NovelViz presents as a normal product:

- Nav call-to-action: **Sign Up →** (pairs with **Sign In**).
- Hero and feature copy unchanged in spirit — still “read without fear”, chapter-gated AI, public domain library.
- Bottom-of-page beta block (email form, “Free during beta”) **removed** so messaging matches reality.

**Note:** Backend **beta mode** (`BETA_MODE=true`) is separate — it only relaxes usage limits for monitoring. It does not control landing copy. See `lib/subscription.ts`.

### Unified footer

**Problem:** The landing page had its own footer (fewer links, different styling). Logged-in areas like **Library** had no site footer at all because `ConditionalPublicFooter` excluded most app routes.

**Solution:** One footer component (`components/public-footer.tsx`) rendered from the root layout for:

- Landing, Discover, Gallery, FAQ, legal pages
- Library, Dashboard, Account, Admin (when applicable)
- Login / Register (guests)

**Exception:** `/reader/[bookId]` — the in-book reading shell stays footer-free so the experience stays immersive.

**Footer content:**

- Links: FAQ, Contact, Privacy Policy, Terms of Service, Acceptable Use
- © 2026 NovelViz. All rights reserved.
- Tagline: *Built for readers, by a reader.*

---

## Part 2 — Environment model (mental map)

NovelViz uses **one Cloudinary account** and **two Neon Postgres branches**. They must stay aligned conceptually:

```text
┌─────────────────────┬──────────────────────────┬─────────────────────────────┐
│ Where you run       │ Database                 │ Cloudinary upload prefix    │
├─────────────────────┼──────────────────────────┼─────────────────────────────┤
│ npm run dev (local) │ Neon development branch  │ novelviz/dev/…              │
│ Vercel Preview      │ (usually dev branch)     │ novelviz/dev/…              │
│ Vercel Production   │ Neon production branch   │ novelviz/prod/…             │
└─────────────────────┴──────────────────────────┴─────────────────────────────┘
```

**Critical rule:** `.env.local` must use the **development** Neon URL. Never put production `DATABASE_URL` in `.env.local`.

**Discover/search** loads books where `status = published` and `deletedAt IS NULL`. It does **not** filter by user. If a title appears on localhost but not on www.novelviz.com, compare **book status on the production branch**, not recommendation scoring.

---

## Part 3 — Cloudinary folder layout

### Why we split folders

Historically, uploads went to flat paths such as `novelviz/gallery/{id}` and `novelviz/covers/{bookId}`. Dev and prod shared those paths, which made it hard to know which environment owned an asset and risky to run cleanup or migration scripts.

### Target structure

```text
novelviz/
  dev/
    gallery/{imageId}              ← Imagine (user-generated scene images)
    covers/user/{bookId}           ← Manual upload, EPUB ingest, Open Library
    covers/ai/{bookId}             ← Cover AI commit
    cover-drafts/{bookId}/{uuid}   ← Cover AI drafts before commit
  prod/
    (same structure)
```

Legacy prefixes are still **accepted for reads** (e.g. in-flight draft commits) but **new uploads** use env-prefixed paths.

### Runtime detection

Implemented in `lib/cloudinary.ts`:

| Condition | Folder root |
|-----------|-------------|
| `VERCEL_ENV=production` | `novelviz/prod/…` |
| Local dev, Vercel Preview | `novelviz/dev/…` |
| `NOVELVIZ_CLOUDINARY_ENV=dev\|prod` | Explicit override (optional) |

### SDK configuration (important for scripts)

The Cloudinary Node SDK does **not** automatically pick up credentials from `dotenv` unless `cloudinary.config()` runs after env load.

`lib/cloudinary.ts` now calls `ensureCloudinaryConfigured()` on import, using either:

- `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`, or
- Parsed `CLOUDINARY_URL` (`cloudinary://api_key:api_secret@cloud_name`)

CLI scripts must load env **before** importing `@/lib/cloudinary` — use `import "./lib/load-env"` at the top of the script (same pattern as `gutenberg-ingest.ts`).

### Upload routes wired to new paths

| Feature | Route / module | Cloudinary folder |
|---------|----------------|-------------------|
| Admin/partner cover upload | `app/api/admin/books/[id]/cover/route.ts` | `covers/user` |
| EPUB ingest cover | `app/api/admin/books/[id]/ingest/route.ts` | `covers/user` |
| Open Library cover | `lib/open-library-cover.ts` | `covers/user` |
| Cover AI commit | `app/api/books/[id]/cover-ai/commit/route.ts` | `covers/ai` |
| Cover AI draft | `app/api/books/[id]/cover-ai/generate/route.ts` | `cover-drafts/{bookId}` |
| Imagine / scene image | `app/api/imagine/route.ts` | `gallery` |

Helper modules:

- `lib/cloudinary-copy-cover.ts` — copy a remote Cloudinary URL into a target env folder (used when promoting covers to prod).

---

## Part 4 — Promoting the dev catalogue to production

### What the script is for

**Script:** `scripts/promote-catalogue-dev-to-prod.ts`

**Purpose:** Copy the **admin catalogue** from the development Neon branch to production so live Discover can serve the same public-domain titles (Dracula, Frankenstein, etc.) that were ingested and reviewed on dev.

**Default source owner:** `dev_user_admin` (books owned by the dev admin user in seed/ingest workflows).

**Default target owner:** `cmpgiq4wj000004k361w2uwz7` (production admin user — override with `--owner-id` if needed).

### What gets copied

| Data | Copied? | Notes |
|------|---------|-------|
| Book metadata (title, author, status, genre, …) | Yes | Includes `published` / `pending_review` / etc. as on dev |
| Chapters (`rawText`, sequence) | Yes | New UUIDs on target |
| Chunk rows + **embeddings** | Yes | Raw SQL insert with `::vector` |
| Book **cover** (Cloudinary) | Yes | Re-uploaded to `novelviz/prod/covers/user\|ai/{bookId}` |
| **GeneratedImage** (Imagine / gallery) | **No** | User-specific; separate lifecycle |
| Users, reading progress, comments | **No** | Not part of catalogue promotion |

Matching existing prod books: by `gutenbergId` first, then by book `id`.

### What it does *not* do (common confusion)

After a successful promote run, you may still see:

- **`novelviz/gallery/`** — legacy Imagine uploads (unchanged by promote)
- **`novelviz/dev/gallery/`** — images created while running locally after the folder split

That is expected. Gallery cleanup is a **separate** step (see Part 5).

### Commands

**Always dry-run first.** Use **real** Neon pooled URLs — not placeholder text like `postgresql://...dev...`.

PowerShell:

```powershell
$env:SOURCE_DATABASE_URL = "postgresql://...@ep-...-dev-pooler....neon.tech/neondb?sslmode=require"
$env:TARGET_DATABASE_URL = "postgresql://...@ep-...-prod-pooler....neon.tech/neondb?sslmode=require"

npx tsx scripts/promote-catalogue-dev-to-prod.ts --dry-run
npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply
```

Alternative (CLI flags):

```powershell
npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply `
  --source-url "postgresql://...dev..." `
  --target-url "postgresql://...prod..." `
  --owner-id cmpgiq4wj000004k361w2uwz7
```

**Requires:** Cloudinary credentials in env (for cover copy).

### Retry failed books only

Large books (many chapters + chunks) originally hit Prisma’s default **5s interactive transaction timeout**. The script now:

- Uses **120s** transaction timeout
- Inserts chapters in batches of 50 via `createMany`

To re-run **only** books where production has fewer chapters than dev:

```powershell
npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply --retry-failed
```

To re-run specific book IDs:

```powershell
npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply --book-id <uuid>
```

### Troubleshooting promote runs

| Symptom | Cause | Fix |
|---------|-------|-----|
| Opaque `ErrorEvent` on dry-run | Placeholder or invalid `SOURCE_DATABASE_URL` / `TARGET_DATABASE_URL` | Paste full Neon pooled URLs from console |
| `Must supply api_key` on `--apply` | Cloudinary SDK not configured when script ran | Ensure `.env.local` has Cloudinary vars; use latest `lib/cloudinary.ts` with `ensureCloudinaryConfigured` |
| `Done. … errors=5` on large titles | Transaction timeout mid-chapter insert | Run `--retry-failed` after timeout fix |
| Covers in prod, gallery still in `novelviz/gallery/` | Promote never copies Imagine assets | Use gallery cleanup or reorganize script (below) |

---

## Part 5 — Gallery and Cloudinary maintenance scripts

### `cleanup-gallery-images.ts` — delete test Imagine data (Cloudinary + DB)

**When to use:** You want a clean gallery on dev or prod and are happy to remove **all** `GeneratedImage` rows and matching Cloudinary gallery files.

**Why use a script:** Deleting files only in the Cloudinary console leaves broken URLs in the database (empty gallery cards, orphaned comments).

**What it deletes:**

- Cloudinary assets under `novelviz/gallery/`, `novelviz/dev/gallery/`, `novelviz/prod/gallery/`
- All `GeneratedImage` rows (comments, likes, feature requests cascade)
- Notifications whose `link` contains `/gallery/`

**Does not delete:** Book covers under `novelviz/prod/covers/` (or dev covers).

```powershell
# Dry-run (counts rows + assets)
npx tsx scripts/cleanup-gallery-images.ts --dry-run

# Apply — point DATABASE_URL at the branch you intend to wipe
npx tsx scripts/cleanup-gallery-images.ts --apply
```

For production cleanup, set `$env:DATABASE_URL` to the **production** branch before `--apply`.

### `cloudinary-reorganize-assets.ts` — migrate legacy paths (optional)

**When to use:** You need to **move** legacy assets into `novelviz/prod/…` (or `dev`) **without** deleting them, and update `Book.coverImageUrl` / `GeneratedImage.imageUrl` in the DB.

```powershell
# DATABASE_URL must match the DB whose URLs you are updating
npx tsx scripts/cloudinary-reorganize-assets.ts --target prod --dry-run
npx tsx scripts/cloudinary-reorganize-assets.ts --target prod --apply
```

Maps e.g. `novelviz/gallery/{id}` → `novelviz/prod/gallery/{id}` and legacy `novelviz/covers/{bookId}` → `novelviz/prod/covers/user|ai/{bookId}` based on `Book.coverIsAiGenerated`.

**Not needed** if you chose to delete test gallery images instead of migrating them.

---

## Part 6 — Discover visibility debugging (Dracula case study)

**Reported issue:** `www.novelviz.com` search returned 0 results for “Dracula”; localhost returned the book.

**Investigation conclusion:**

- Discover client filters **published** books only (`status: published`, not soft-deleted).
- Featured scoring affects carousel ordering, **not** search eligibility.
- Root cause: **production Neon branch** still had titles as `pending_review` while the **development** branch had `published` after seed/ingest work — not a code bug in search.

**Lesson for operators:** After promoting catalogue, confirm `status` on production matches intent. Re-ingesting a published book via admin ingest can demote it to `pending_review` (see ingest route behaviour).

Deleting dev users (`lib/delete-user.ts`) nulls `ownerId` on books; it does **not** change book status.

---

## Part 7 — Recommended deployment checklist

Use this order when bringing production in line with dev catalogue and new Cloudinary layout:

1. **Deploy application code** with env-prefixed Cloudinary uploads and footer/sign-up changes.
2. **Verify env vars on Vercel Production:** production Neon URLs, Clerk prod keys, Cloudinary credentials (`CLOUDINARY_URL` or split keys).
3. **Promote catalogue** (dry-run → apply) with `SOURCE_DATABASE_URL` = dev, `TARGET_DATABASE_URL` = prod.
4. **Retry failures** if needed: `--retry-failed`.
5. **Gallery strategy (pick one):**
   - **Clean slate:** `cleanup-gallery-images.ts --apply` on prod (and optionally dev).
   - **Migrate legacy URLs:** `cloudinary-reorganize-assets.ts --target prod --apply` with prod `DATABASE_URL`.
6. **Smoke test production:** Discover search for known titles, spot-check cover URLs, confirm footer on Library and landing.

---

## Part 8 — File reference (quick index)

| Path | Role |
|------|------|
| `lib/cloudinary.ts` | Env folder helpers, legacy prefix constants, SDK config |
| `lib/cloudinary-copy-cover.ts` | Copy cover URL into `novelviz/{env}/covers/user\|ai/` |
| `lib/cover-ai-access.ts` | Draft path allowlist (legacy + dev + prod) |
| `components/public-footer.tsx` | Shared site footer |
| `components/conditional-public-footer.tsx` | Footer visibility (hide on `/reader/*` only) |
| `app/(marketing)/landing-client.tsx` | Landing page; Sign Up CTA; beta section removed |
| `scripts/promote-catalogue-dev-to-prod.ts` | Dev → prod catalogue + covers + embeddings |
| `scripts/cleanup-gallery-images.ts` | Wipe gallery Cloudinary + `GeneratedImage` rows |
| `scripts/cloudinary-reorganize-assets.ts` | Rename legacy Cloudinary paths + update DB URLs |
| `docs/database-environments.md` | Neon/Vercel/local env guide (§10 Cloudinary) |

---

## Part 9 — Earlier session context (auth, not re-implemented here)

The same development period included fixes to **registration and auth** (documented in [sign-up-onboarding.md](./sign-up-onboarding.md) and [auth-workflow.md](./auth-workflow.md)):

- Google sign-up legal consent alignment
- Clerk CAPTCHA / email verification on register
- Username collection on the register page

Those flows are independent of catalogue promotion but part of the same “ready for real users” milestone.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Catalogue** | Platform-owned public-domain books available in Discover (not a user’s library list) |
| **Imagine** | Chapter-gated scene image generation (`/api/imagine` → `GeneratedImage`) |
| **Cover AI** | Admin/partner tool to generate book cover art; commits to `covers/ai` |
| **Promote** | Copy dev admin catalogue rows to production Neon + prod Cloudinary covers |
| **Legacy Cloudinary path** | Pre-split paths: `novelviz/gallery/`, `novelviz/covers/`, `novelviz/cover-drafts/` |

---

*Last updated: June 2026 — reflects production launch preparation work (Cloudinary env folders, catalogue promotion, gallery cleanup, beta → launch UI).*
