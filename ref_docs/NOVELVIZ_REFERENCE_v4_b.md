# NovelViz Reference
**Version 4** — Updated May 2026

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

**New user flow:** `/register` → Clerk → `/auth/after` → `/onboarding` → `/library`
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
│                        /admin/gutenberg-import, /admin/cover-refresh
└── api/
```

---

## Roles

- `reader` — browse, library, Q&A, image gen, gallery, dashboard
- `partner` — reader + upload books, manage catalogue, view own book stats, request image featuring
- `admin` — everything + moderation, all stats, approve/reject submissions, approve/reject feature requests, Helpers
- Hierarchy: reader ⊂ partner ⊂ admin

---

## Schema

**User:** `clerkId`, `username` (public), `name`, `email`, `role`, `gender`, `ageRange`, `country`, `genrePreferences`, `subscribedToMailingList`, `globalSpoilerProtection` (bool, default true)

**Book:** `title`, `author`, `description`, `genre` (BookGenre), `status` (BookStatus), `ownerId`, `coverImageUrl`, `isPublicDomain`, `deletedAt` (soft delete), `publishedYear` (Int?), `openLibraryKey` (String?), `gutenbergId` (Int? @unique), `ingestionPromptTokens` (Int?), `ingestionCompletionTokens` (Int?), `listingPreferenceAfterReview` (String? — `"published"` or `"unlisted"`, set by partner on submit, cleared after admin action), `rejectionReason` (String?, set on reject), `internalNotes` (String?, rejection reason prepended as block by `lib/book-rejection-notes.ts`)

**Chapter:** `bookId`, `sequenceNumber`, `title`, `rawText`

**Chunk:** `chapterId`, `bookId` (denormalised for pgvector perf), `sequenceNumber`, `content` (~500 tokens), `embedding` (1536-dim vector)

**UserBook:** User↔Book join. `spoilerProtection` (SpoilerProtection enum, default INHERIT), `isActive` (bool)

**ReadingProgress:** `userId`, `bookId`, `currentChapter`

**Query:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `questionText`, `responseText`, `promptTokens`, `completionTokens`, `embeddingTokens`

**GeneratedImage:** `userId`, `bookId`, `chapterNumberAtTime` (int snapshot), `userPrompt`, `fullPrompt`, `imageUrl` (always Cloudinary URL), `isPublic` (default false), `isFeatured` (default false), `model`, `promptTokens`, `completionTokens`, `embeddingTokens`, `subjectTokens`

**FeatureRequest:** `imageId`, `requestedBy`, `status` (FeatureRequestStatus), `reviewedBy` (nullable), `createdAt`, `updatedAt`. `@@unique([imageId])` — one active request per image at a time.

**BookRequest:** user-submitted catalogue requests

**Like:** `@@unique([userId, imageId])`

**Comment:** `id`, `imageId`, `userId`, `content`, `status` (CommentStatus, default VISIBLE), `spoilerGateChapter` (Int?), `spoilerModerationAt` (DateTime?), `spoilerScanDebug` (Json?), `createdAt`, `updatedAt`. Relations: GeneratedImage (cascade delete), User (cascade delete).

**Notification:** `id`, `userId`, `type` (NotificationType), `message`, `link`, `read` (bool, default false), `createdAt`. Relation: User (cascade delete). Retained for 30 days.

### Enums

```
BookStatus:           draft | processing | ready_for_review | pending_review | published | unlisted | rejected
BookGenre:            fantasy | horror | romance | adventure | mystery | science_fiction | historical_fiction | literary_fiction | thriller | childrens_fiction | classic_literature | gothic | crime | biography | short_stories
UserRole:             reader | partner | admin
Gender:               male | female | non_binary | other | prefer_not_to_say
SpoilerProtection:    INHERIT | PROTECTED | UNLOCKED
FeatureRequestStatus: PENDING | APPROVED | REJECTED
CommentStatus:        VISIBLE | HIDDEN_SPOILER | PENDING_CONTENT_REVIEW | DELETED
NotificationType:     COMMENT_HIDDEN_PENDING | COMMENT_REINSTATED | COMMENT_RELEASED |
                      COMMENT_SPOILER_REMOVED | COMMENT_SPOILER_CONFIRMED_GATED |
                      COMMENT_REPORTED_TO_AUTHOR | COMMENT_FLAGGED_FOR_MODERATION |
                      COMMENT_FLAGGED_RESTORED | COMMENT_FLAGGED_REMOVED |
                      BOOK_APPROVED | BOOK_REJECTED |
                      FEATURE_REQUEST_APPROVED | FEATURE_REQUEST_REJECTED
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

| Model | Endpoint | Price | Who |
|---|---|---|---|
| xai/grok-imagine-image | `xai/grok-imagine-image` | $0.02/image | Readers, partners, admins (default) |
| Seedream v4.5 | `bytedance/seedream/v4.5/text-to-image` | $0.04/image | Admin only |
| flux/schnell | `fal-ai/flux/schnell` | ~$0.003/image | Admin only (dev/test) |

`GeneratedImage.model` records which model was used. All schnell-generated images must be deleted before production launch.

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
- Anthropic 404 → fall through to next candidate. All fail → 502.
- fal.ai fail → 502
- fal.ai no URL → 502, full response logged
- Cloudinary upload fail → 502. Never saves fal URL to DB.
- Comment scan fail → logged, comment stays VISIBLE (fail open)

### Key AI Files

| File | Purpose |
|---|---|
| `lib/anthropic.ts` | Anthropic client singleton |
| `lib/ingestion.ts` | OpenAI embeddings, chunking, EPUB parsing, genre detection |
| `lib/fal.ts` | fal.ai client |
| `lib/comment-scan.ts` | Async Claude comment spoiler scan |
| `lib/costs.ts` | Cost constants + estimation helpers |
| `lib/open-library.ts` | Open Library metadata enrichment |
| `lib/discover-catalogue.ts` | Featured books query |
| `app/api/query/route.ts` | Q&A endpoint |
| `app/api/imagine/route.ts` | Image generation endpoint |
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
- Admin (+ divider): For Review · Spoiler Comments · Flagged Comments · Feature Approvals · Helpers · All Books · All Users · Admin Stats

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

1. fal.ai returns temporary CDN URL
2. Generate `imageId = randomUUID()`
3. Upload to Cloudinary: `folder: "novelviz/gallery"`, `public_id: imageId`
4. Store `cloudinaryResult.secure_url` in `GeneratedImage.imageUrl`
5. Cloudinary upload fail → 502, nothing saved to DB

Cloudinary plan: Free tier (25 credits/month). Covers: `novelviz/covers/[bookId]`, gallery: `novelviz/gallery/[imageId]`. OL covers fetched via Cloudinary remote fetch (not stored as direct third-party URLs).

---

## Open Items

### Must fix before launch

- Wire Clerk production auth into `lib/auth.ts` — mock dev users currently. TODO comment in place.
- `DIRECT_URL` must be set in `.env.local` for migrations.
- Neon free tier 0.5GB — upgrade to Launch plan ($5/mo) before beta. Enables Neon consumption API.
- `prisma migrate deploy` needed on production DB for all pending migrations (spoiler protection, isFeatured, FeatureRequest, Comment, Notification).
- `prisma migrate dev` shadow DB fails — use `npx prisma migrate deploy` for local migrations.
- Gallery redesign (`gallery-redesign.css`) — prompt written, not yet implemented.
- Dashboard redesign (`dashboard-redesign.css`) — prompt written, implementation in progress.
- Library redesign (`library-redesign.css`) — prompt written, implementation in progress.
- Gallery like dedup — route-level guard needed (DB constraint exists, route guard missing).
- Clickable padlock icons — red + yellow actionable, green + aqua tooltip only. Not yet implemented.
- Delete all schnell-generated images before production launch.
- Create `FAL_ADMIN_API_KEY` (Admin key from fal dashboard) — required for vendor billing in admin stats.

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

### Known Edge Cases

- EPUB >4.5MB: Vercel payload limit. Fix: direct browser→Cloudinary upload.
- Non-chapter content (poems, interludes, prologues) dropped during EPUB parsing.
- Gutenberg `dc:date` = digitisation date — Open Library enrichment fixes for new ingestions.
- Open Library may occasionally match wrong edition for common titles.
- Comment scan is fail-open: scan failure leaves comment VISIBLE.
- `PENDING_CONTENT_REVIEW` comments invisible to all readers except author and admins — slow admin review means legitimate comment appears missing with no explanation.

---

## Dev Workflow

- Claude writes all Cursor prompts → Chris pastes into Cursor Composer
- Plan mode before Agent mode for multi-file tasks
- Commit after each session before switching machines (laptop ↔ desktop)
- `CURSOR.md` + `NOVELVIZ_REFERENCE_v4.md` maintained as persistent context
- `dev` branch → staging; merge to `main` → production
- Domain: novelviz.com — DNS on Namecheap → Vercel. Do not delete DNS records.
- **gitignore `!` prefix is a footgun** — never use near env files. `.env.example` was tracked, credentials exposed, all keys rotated. Always audit gitignore rules.
- JSX prototypes provided to Cursor as reference files — Cursor reads for visual/structural intent and wires to real data, does not use mock data
- Queue files (`gutenberg-queue.json`, `gutenberg-queue-deferred.json`) are gitignored — copy between machines to share approvals and deferred lists
