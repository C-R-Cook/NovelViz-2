# NovelViz — Cursor Project Brief

## What is NovelViz
NovelViz is a web app that provides chapter-gated AI features for book readers. Users register,
browse a catalogue of books, and add books they own to their personal library. They set their
current chapter, then unlock two core AI features: asking questions about the book and generating
images of characters, places, objects, and scenes. Every AI response is strictly limited to
content from chapters the user has already reached — no spoilers, no future context.

Users never read books on the site. They tell us what they own in the real world.
We provide the intelligence layer on top of that.

## Tech Stack
- **Framework:** Next.js 16 (app router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts (partner analytics):** Recharts
- **Auth:** Clerk
- **ORM:** Prisma
- **Database:** Neon (Postgres) with pgvector extension for semantic search
- **Hosting:** Vercel
- **AI — Q&A:** Anthropic API
- **AI — Image Generation:** fal.ai or Replicate
- **Package Manager:** npm

## Folder Structure

novelviz/
├── app/
│   ├── (public)/              # Marketing, discover (catalogue), gallery, legal
│   ├── (reader)/              # Auth-aware reader shell + onboarding
│   │   └── (app)/             # Library, dashboard, reader, account (nested authenticated app)
│   ├── (partner)/             # Partner (publisher) dashboard, books CRUD, per-book stats
│   ├── admin/                 # Admin book management, requests, stats
│   ├── api/                   # Route handlers (REST-style)
│   ├── generated/prisma/      # Prisma client output (`@db` alias)
│   ├── layout.tsx             # Root layout
│   ├── login/ / register/     # Clerk-hosted auth routes
│   └── sign-in/
├── components/                # Shared UI; partner analytics under components/partner/
├── lib/                       # Shared logic (auth, prisma, ingestion, discover, fal, anthropic…)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── CURSOR.md                  # This file

## Database Schema
All models are defined in `prisma/schema.prisma`. Migrations are applied per environment.

### Models

**Book**
- **status** (`BookStatus`): `draft` | `pending_review` | `rejected` | `published` | `unlisted` | `processing`
  - `processing` — ingestion in progress (chunking, embeddings)
  - `pending_review` — ingestion finished or submitted; awaiting admin before catalogue changes
- **genre** — `BookGenre` enum (fantasy, horror, romance, adventure, mystery, science_fiction, etc.)
- **listingPreferenceAfterReview** — partner hint for publish vs unlist after review
- **rejectionReason** (optional)
- **scheduledPublishAt** (nullable)
- **isPublicDomain** (boolean)
- **ownerId** (nullable FK to `User.id` — partner owner when assigned)
- **deletedAt** (nullable) — soft delete; queries exclude deleted books where applicable
- Standard metadata: title, author, coverImageUrl, description, publishedYear

**Chapter**
- belongs to Book via bookId
- sequenceNumber (Int)
- title (nullable)
- rawText (full chapter content)

**Chunk**
- belongs to Chapter via chapterId
- bookId denormalized for faster pgvector filtering
- sequenceNumber (Int)
- content (text segment)
- embedding (`vector(1536)`) — pgvector via Prisma extensions

**UserRole** (enum)
- `reader` — standard catalogue and library access
- `partner` — publisher-style access (owns books, dashboard, submissions)
- `admin` — catalogue ingestion, book management, and other admin surfaces

**User**
- **clerkId** — Clerk user ID, linked to DB record
- **email**, **name**, optional **username** (unique)
- **gender** — optional `Gender` enum
- **role** — `UserRole`, default `reader`
- **ageRange** — optional `AgeRange` enum: `UNDER_18`, `EIGHTEEN_24`, `TWENTY5_34`, `THIRTY5_44`, `FORTY5_54`, `FIFTY5_PLUS`, `PREFER_NOT_TO_SAY`
- **genrePreferences** — string array
- **subscribedToMailingList**, **country**

**UserBook**
- join between User and Book
- **addedAt**, **isActive** (boolean)

**ReadingProgress**
- links User and Book
- **currentChapterId** (FK to Chapter)
- **currentChapterNumber** (Int, denormalized)

**Query**
- userId, bookId
- **chapterNumberAtTime** (Int snapshot — not a FK, preserves audit trail)
- questionText, responseText
- optional token usage fields

**GeneratedImage**
- userId, bookId
- **chapterNumberAtTime** (Int snapshot)
- userPrompt, fullPrompt, imageUrl
- **isPublic** (gallery), **likeCount**
- model / cfgScale / seed / steps / width / height / sampler / negativePrompt / rawParameters
- optional token usage fields

**BookRequest**
- userId (optional), bookTitle, authorName, optional message

### pgvector Setup
Declared on the datasource via `extensions = [vector]`; migration ensures `CREATE EXTENSION IF NOT EXISTS vector` where needed.

## Key Architectural Decisions

### Chapter Gating
When a user triggers any AI feature, the server:
1. Resolves their current chapter from ReadingProgress
2. Queries only Chunks with chapterNumber <= currentChapterNumber using pgvector semantic search
3. Passes only those chunks as context to the AI
4. Instructs the AI via system prompt that it must not reference anything beyond the provided context

This is the core feature of the product. Every AI interaction must respect this boundary.

### Snapshots vs Foreign Keys
`Query.chapterNumberAtTime` and `GeneratedImage.chapterNumberAtTime` store the chapter number at the moment of the interaction. They are not foreign keys to `ReadingProgress`. This preserves an accurate audit trail regardless of future progress updates.

### Image Generation Parameters
`GeneratedImage` stores explicit columns for common parameters plus `rawParameters` Json for model-specific options.

### Book Ingestion Pipeline
Admin-driven pipeline: upload / EPUB ingest → chapters → chunks (~500 tokens with overlap) → embeddings → status transitions (`processing`, then admin review paths).

### User Roles
Roles on `User.role`: **reader** | **partner** | **admin**. **Partner** is the product term for authors/publishers (not “publisher” in code).

### Partner Analytics
Dashboard and `/partner/books/[id]/stats` load aggregated metrics from **`lib/partner-analytics.ts`** (account-wide) and **`lib/partner-book-analytics.ts`** (single book). Charts live in **`components/partner/analytics-charts.tsx`** (Recharts); accent colours resolve via CSS variables (`useCSSVar` on `document.body`, with `MutationObserver` on `body` class for palette switches). **`lib/partner-analytics-mock.ts`** can serve demo series when **`USE_PARTNER_ANALYTICS_MOCK`** is `true` (disable before relying on production numbers).

## Naming Conventions
- Files and folders: kebab-case
- React components: PascalCase
- Functions and variables: camelCase
- Database models: PascalCase (Prisma convention)
- API routes: `/api/[resource]/[id]` REST-style conventions

## API Routes (representative)

**Webhook**
- `POST /api/webhooks/clerk`

**Books (public discover pagination)**
- `GET /api/books` — cursor + genre filtering for `/discover`

**Library**
- `POST /api/library/[bookId]` — add / reactivate library entry
- `DELETE /api/library/[bookId]` — soft-remove (isActive false)

**Reading progress**
- `GET` / `POST /api/progress/[bookId]`

**AI**
- `POST` / `GET /api/query`
- `POST` / `GET /api/imagine`

**Gallery**
- `PATCH /api/gallery/[imageId]` — visibility / metadata updates as implemented
- `POST /api/gallery/[imageId]/like`

**Book requests**
- `GET` / `POST /api/requests`

**Account & onboarding**
- `GET` / `PATCH /api/account`
- `GET` / `POST /api/onboarding`
- `POST /api/onboarding/check-username`

**Partner**
- `GET` / `POST /api/partner/books`
- `PATCH /api/partner/books/[id]` (book updates and status transitions for owned books)
- `POST /api/partner/books/epub-metadata`

**Admin (books pipeline)**
- `GET` / `POST /api/admin/books`
- `PATCH` / `DELETE /api/admin/books/[id]`
- `POST /api/admin/books/[id]/ingest`
- `POST /api/admin/books/[id]/cover`
- `PATCH /api/admin/books/[id]/status`
- `GET` / `POST /api/admin/books/[id]/chapters`
- `PATCH` / `DELETE /api/admin/books/[id]/chapters/[chapterId]`
- `POST /api/admin/books/[id]/chapters/merge`

**Misc**
- `POST /api/contact`

(Legacy checklist items like `/api/auth/register` are not separate handlers; Clerk handles auth UI + webhook sync.)

## What is Built

- Next.js 16 app, Prisma + Neon + pgvector, Tailwind
- Clerk integration (`@clerk/nextjs`, webhook), dev role override via **`dev_role`** cookie + seeded **`DEV_USERS`** in **`lib/auth.ts`** for local work
- **Public:** homepage, **`/discover`** (paginated catalogue; `/books` redirects here), **`/gallery`**, **`/faq`**, **`/contact`**, terms/privacy
- **Reader:** onboarding, **`/library`**, **`/dashboard`** (includes partner analytics tab when role is partner), **`/reader/[bookId]`** (Ask / Imagine / progress), **`/account`**
- **Partner:** **`/partner/dashboard`**, create book, book detail, **`/partner/books/[id]/stats`** (charts + KPIs); partner APIs for books / EPUB metadata
- **Admin:** books list/detail, ingestion, chapters (incl. merge), cover upload, status, requests, stats page
- Q&A and image generation (chapter-gated retrieval, Anthropic + fal.ai), Cloudinary covers, EPUB metadata optional on ingest

## What is NOT Built Yet (examples)

- Full “production-only” auth story without dev seeded users / cookie override
- Retailer outbound links as a product feature
- Deep community / social layer beyond public gallery browsing and likes on shared images

## Build Order (high level)

1. Project scaffold ✅  
2. Database schema and migrations ✅  
3. Auth (Clerk + DB user linkage; local dev helpers) ✅  
4. Catalogue / discover ✅  
5. Library ✅  
6. Reading progress ✅  
7. Admin ingestion pipeline ✅  
8. Q&A ✅  
9. Image generation ✅  
10. Gallery (public browsing + APIs) ✅  
11. Partner dashboard, books, per-book statistics UI ✅  

## Environment Variables
See `.env.example` for required keys. Never commit `.env.local` to Git.

### Subscription / beta
- **`BETA_MODE=true`** — usage limits are computed and returned but **not enforced** (`lib/subscription.ts`). Set on Vercel during beta; **must be `false` (or unset) before production launch** when limits should apply.
- **`STRIPE_SECRET_KEY`** / **`STRIPE_WEBHOOK_SECRET`** — not yet active; stub webhook at `POST /api/webhooks/stripe`.

## Known Decisions

- Prisma client: `provider = "prisma-client"` with **`output`** to **`app/generated/prisma`**, imported via **`@db`** alias.
- Seeding: `tsx prisma/seed.ts`.
- Local auth: **`NODE_ENV !== 'production'`** — **`getCurrentUser()`** can map **`dev_role`** cookie → **`DEV_USERS`**; invalid/missing cookie defaults to admin for convenience. Clerk remains the real auth path elsewhere.
- **`DIRECT_URL`** in `.env.local` for migrations (Neon).
- **`CLOUDINARY_URL`** for cover/storage; ingestion can extract EPUB covers.
- Visiting **`/reader/[bookId]`** can bootstrap **`UserBook`** / **`ReadingProgress`** where applicable.
- Re-seeding catalogue books avoids overwriting **`coverImageUrl`** (preserve Cloudinary URLs).
- **`Book.deletedAt`**: partner/admin flows respect soft-delete in queries (`deletedAt: null`).
- **`lib/genre.ts`** / **`BookGenre`** power filters and analytics labels consistently.
