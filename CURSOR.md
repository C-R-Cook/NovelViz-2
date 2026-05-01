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
- **Auth:** Clerk
- **ORM:** Prisma
- **Database:** Neon (Postgres) with pgvector extension for semantic search
- **Hosting:** Vercel
- **AI — Q&A:** Anthropic API
- **AI — Image Generation:** fal.ai or Replicate
- **Package Manager:** npm

## Folder Structure

novelviz/
├── app/                        # Next.js app router pages
│   ├── (public)/               # Unauthenticated routes
│   ├── (reader)/               # Authenticated reader routes
│   ├── admin/                  # Admin routes
│   └── api/                    # API route handlers
├── components/                 # Reusable React components
├── lib/                        # Shared logic, helpers, API clients
│   ├── anthropic.ts            # Anthropic API client
│   ├── prisma.ts               # Prisma client singleton
│   └── image.ts                # Image generation client
├── prisma/
│   └── schema.prisma           # Database schema
└── CURSOR.md                   # This file

## Database Schema
All models are defined in prisma/schema.prisma. Migration has been run successfully.

### Models

**Book**
- status enum: draft | pending_review | rejected | published | unlisted | processing
  - `processing` — ingestion in progress (chunking, embeddings)
  - `pending_review` — ingestion finished or submitted; awaiting admin before catalogue changes
- scheduledPublishAt (nullable datetime)
- isPublicDomain (boolean)
- ownerId (nullable foreign key to `User.id`; partner owner when assigned)
- Standard metadata: title, author, coverImageUrl, description, genre, publishedYear

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
- embedding (vector) — pgvector field for semantic search

**UserRole** (enum)
- `reader` — standard catalogue and library access
- `partner` — publisher-style access (the original brief “publisher” role is represented as **partner**)
- `admin` — catalogue ingestion, book management, and other admin surfaces

**User**
- clerkId — Clerk user ID, used to link Clerk auth to our DB record
- email, name, country
- **role** — `UserRole`, default `reader`
- ageRange enum: EIGHTEEN_24 | TWENTY5_34 | THIRTY5_44 | FORTY5_54 | FIFTY5_PLUS
- genrePreferences (string array)

**UserBook**
- join between User and Book
- addedAt, isActive (boolean)

**ReadingProgress**
- links User and Book
- currentChapterId (foreign key to Chapter)
- currentChapterNumber (Int, denormalized for speed)

**Query**
- userId, bookId
- chapterNumberAtTime (Int snapshot — not a foreign key, preserves audit trail)
- questionText, responseText

**GeneratedImage**
- userId, bookId
- chapterNumberAtTime (Int snapshot — not a foreign key, preserves audit trail)
- userPrompt (what the user typed)
- fullPrompt (enriched prompt sent to image API)
- imageUrl
- isPublic (boolean, for gallery)
- likeCount (Int, default 0)
- Generation parameters: model, cfgScale (Float), seed (BigInt), steps (Int),
  width (Int), height (Int), sampler, negativePrompt, rawParameters (Json)

**BookRequest**
- userId, bookTitle, authorName

### pgvector Setup
Enabled via Prisma previewFeatures and datasource extensions in schema.prisma:
previewFeatures = ["postgresqlExtensions"]
extensions = [vector]

## Key Architectural Decisions

### Chapter Gating
When a user triggers any AI feature, the server:
1. Resolves their current chapter from ReadingProgress
2. Queries only Chunks with chapterNumber <= currentChapterNumber using pgvector
   semantic search
3. Passes only those chunks as context to the AI
4. Instructs the AI via system prompt that it must not reference anything
   beyond the provided context

This is the core feature of the product. Every AI interaction must respect this boundary.

### Snapshots vs Foreign Keys
Query.chapterNumberAtTime and GeneratedImage.chapterNumberAtTime store the chapter
number at the moment of the interaction. They are not foreign keys to ReadingProgress.
This is intentional — it preserves an accurate audit trail regardless of future
progress updates.

### Image Generation Parameters
GeneratedImage stores explicit columns for common parameters (cfgScale, seed, steps,
width, height, sampler, negativePrompt, model) plus a rawParameters Json field as a
catch-all for model-specific options. This supports a future power user / advanced mode.

### Book Ingestion Pipeline
Books are ingested by an admin only. The pipeline:
1. Admin uploads raw text
2. System splits into chapters
3. Chapters split into chunks (~500 tokens with overlap)
4. Each chunk is embedded and stored with its vector
5. Book status set to `processing` during ingest, then `pending_review` or `draft` for admin review before publishing

This is a background process, not an inline API call.

### User Roles
Roles are stored on `User.role` as the `UserRole` enum (`reader` | `partner` | `admin`).
- **Reader** — standard authenticated user (default)
- **Partner** — publisher-style capabilities when implemented (replaces the earlier brief name “publisher”)
- **Admin** — full catalogue and user management

## Naming Conventions
- Files and folders: kebab-case
- React components: PascalCase
- Functions and variables: camelCase
- Database models: PascalCase (Prisma convention)
- API routes: /api/[resource]/[id] REST convention

## API Routes
**Auth**
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

**Catalogue**
GET  /api/books
GET  /api/books/:id
GET  /api/books/:id/chapters

**Library**
GET    /api/library
POST   /api/library/:bookId
DELETE /api/library/:bookId

**Reading Progress**
GET  /api/progress/:bookId
POST /api/progress/:bookId

**AI — Q&A**
POST /api/query
GET  /api/query?bookId=:bookId

**AI — Image Generation**
POST /api/imagine
GET  /api/imagine?bookId=:bookId

**Gallery**
GET   /api/gallery
PATCH /api/gallery/:imageId
POST  /api/gallery/:imageId/like

**Book Requests**
GET  /api/requests
POST /api/requests

**Admin**
GET    /api/admin/books
POST   /api/admin/books
PUT    /api/admin/books/:id
POST   /api/admin/books/:id/ingest  (multipart `file`; optional `applyEpubMetadata=true` for EPUB OPF → book metadata)
GET    /api/admin/requests
GET    /api/admin/users

## What is Built
- Session 1: Next.js 16 scaffold, Prisma, Clerk, Neon connection, Tailwind,
  folder structure, .env.example, homepage placeholder
- Session 2: Full database schema, pgvector enabled, initial migration run
- Auth flow (sign up, login, user record created in DB)
- Session 3: Dev auth helper (lib/auth.ts) with mock user for local development
- Prisma seed script with 8 public domain books and dev users (see Session 5 / Known Decisions)
- Catalogue pages: /books grid with genre filter, /books/[id] detail page
- Library pages: /library with add/remove functionality
- API routes: POST and DELETE /api/library/[bookId]
- Public layout with nav, reader layout with nav
- Session 4:
  - Dev role switcher (layout nav control, cookie-based role override for local dev; server passes `initialRole` from `getCurrentUser()` so SSR/hydration match the cookie)
  - Reading progress: `/reader/[bookId]` page, chapter selector, save/retrieve via `/api/progress/[bookId]`
  - Cloudinary integration (`lib/cloudinary.ts`) for cover image storage
  - Cover image upload on admin book detail page
  - Automatic EPUB cover extraction and Cloudinary upload during ingestion
  - `UserBook` record auto-created when user visits reader page
  - Role-based navigation and route protection in `(public)`, `(reader)`, `(partner)`, and `admin` layouts
  - `getRoleHomeUrl(role)` helper added to `lib/auth.ts`; dev role switcher redirects to role home
  - Partner dashboard placeholder page at `/partner/dashboard`
  - Q&A feature: reader page ask flow + history panel backed by `/api/query`
  - Image generation: reader page “Generate Image” tab + history, backed by `/api/imagine` (Anthropic prompt enrichment + fal.ai `fal-ai/flux/schnell`)
- Session 5 (recent):
  - **Dev users:** seed creates `dev_user_reader`, `dev_user_partner`, `dev_user_admin` (distinct `clerkId`s) plus legacy `dev_user_local`; `getCurrentUser()` maps `dev_role` cookie → `DEV_USERS[...]` (default admin). See Known Decisions.
  - **Imagine:** Anthropic subject extraction before embed; dual pgvector retrieval (prompt + subject), merged/deduped chunks; subject-focused enrichment prompt; optional `IMAGINE_DEBUG` logs; `POST /api/imagine` returns `image` row for UI.
  - **Reader UI:** compact book header + reading bar; Ask & Imagine with Generate first; My Library cards link to `/reader/[bookId]`; new generation opens same modal as history; horizontal image carousel, modal with expandable prompts + copy icons; nav primary links left-aligned across shells.
  - **Admin book detail:** ingest CTA top-right of title; cover change via hover/click on cover; EPUB ingest optional `applyEpubMetadata` (OPF Dublin Core → book fields via `extractEpubMetadataFromOpf` in `lib/ingestion.ts`).
  - **Seed:** book re-seed updates metadata/status only — never `coverImageUrl` (Cloudinary covers preserved).

## What is NOT Built Yet

- Partner feature set beyond dashboard placeholder
- Full Clerk auth for production
- Book moderation workflow
- Retailer links
- Community features
- Public gallery and likes

## Build Order
1. ✅ Project scaffold
2. ✅ Database schema and migration
3. ✅ Auth (sign up, login, user record created in DB)
4. ✅ Catalogue pages (read only, public)
5. ✅ Library (add/remove books, dashboard)
6. ✅ Reading Progress (chapter selector, save and retrieve)
7. ✅ Book ingestion (admin, chunking, embeddings)
8. ✅ Q&A feature
9. ✅ Image generation feature
10. Gallery (public images, likes, public/private toggle)

## Environment Variables
See .env.example for all required keys.
Never commit .env.local to Git.

## Known Decisions
- Prisma client uses `prisma-client` provider with output to `app/generated/prisma`, imported via `@db` path alias
- Seeding uses `tsx prisma/seed.ts` (not ts-node) due to Prisma 7 ESM client
- Auth locally (`NODE_ENV !== 'production'`): `getCurrentUser()` reads `dev_role` cookie and returns the matching entry from `DEV_USERS` (`reader` | `partner` | `admin` DB-aligned ids/clerkIds); missing/invalid cookie → admin. Legacy `dev_user_local` remains in seed for compatibility. Clerk to be wired in `lib/auth.ts` before go-live
- DIRECT_URL must be set in .env.local for migrations and db push (Neon requirement)
- Cloudinary used for image storage (`CLOUDINARY_URL` in `.env.local`). `crop: "fit"` transformation enforces consistent cover dimensions
- EPUB cover auto-extracted from manifest `properties="cover-image"` during ingestion, falls back to manifest item whose `id` contains `"cover"`
- Visiting `/reader/[bookId]` auto-creates `UserBook` and `ReadingProgress` at Chapter 1 if they do not exist
- `UserRole` enum: `reader`, `partner`, `admin`. Local dev uses per-role seeded users (see Session 5); default dev role when cookie absent is **admin**
- **Partner** is the term used for authors/publishers/resellers (replaces “publisher” from the original brief)
- Q&A retrieval is chapter-gated: question is embedded with `text-embedding-3-small`, top relevant chunks are selected via pgvector constrained to chapter sequence <= current reader progress, and response is stored in `Query`
- Q&A uses Anthropic models with fallback support via `ANTHROPIC_MODEL` env var (comma-separated candidates supported)
- Image generation: chapter-gated **dual** retrieval (embeddings for user prompt + Anthropic-extracted primary subject), merged chunks; Anthropic (`ANTHROPIC_MODEL`) enrichment with subject-focused system prompt; fal.ai (`FAL_API_KEY`, `lib/fal.ts`, `fal-ai/flux/schnell`); `GeneratedImage` persisted; optional `IMAGINE_DEBUG=true` in `.env.local` for retrieval/subject diagnostic logs
- Re-running **prisma seed** for catalogue books updates `status`, `isPublicDomain`, `genre`, `description`, `publishedYear` only — **not** `coverImageUrl` (uploaded Cloudinary covers kept)
