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
- status enum: draft | published | unlisted | processing | ready_for_review
  - `processing` — ingestion in progress (chunking, embeddings)
  - `ready_for_review` — ingestion finished; awaiting admin before catalogue changes
- scheduledPublishAt (nullable datetime)
- isPublicDomain (boolean)
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

**User**
- clerkId — Clerk user ID, used to link Clerk auth to our DB record
- email, name, country
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
5. Book status set to `processing` during ingest, then `ready_for_review` or `draft` for admin review before publishing

This is a background process, not an inline API call.

### User Roles
- **Reader** — standard authenticated user
- **Admin** — full catalogue and user management
- **Publisher** — future role, not yet implemented

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
PUT  /api/progress/:bookId

**AI — Q&A**
POST /api/query

**AI — Image Generation**
POST /api/imagine
GET  /api/imagine/:bookId

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
POST   /api/admin/books/:id/ingest
GET    /api/admin/requests
GET    /api/admin/users

## What is Built
- Session 1: Next.js 16 scaffold, Prisma, Clerk, Neon connection, Tailwind,
  folder structure, .env.example, homepage placeholder
- Session 2: Full database schema, pgvector enabled, initial migration run
- Auth flow (sign up, login, user record created in DB)
- Session 3: Dev auth helper (lib/auth.ts) with mock user for local development
- Prisma seed script with 8 public domain books and dev user
- Catalogue pages: /books grid with genre filter, /books/[id] detail page
- Library pages: /library with add/remove functionality
- API routes: POST and DELETE /api/library/[bookId]
- Public layout with nav, reader layout with nav

## What is NOT Built Yet

- Any pages beyond homepage placeholder
- Any API routes
- Book ingestion pipeline
- All AI features

## Build Order
1. ✅ Project scaffold
2. ✅ Database schema and migration
3. ✅ Auth (sign up, login, user record created in DB)
4. ✅ Catalogue pages (read only, public)
5. ✅ Library (add/remove books, dashboard)
6. Reading Progress (chapter selector, save and retrieve)
7. Book ingestion (admin, chunking, embeddings)
8. Q&A feature
9. Image generation feature
10. Gallery (public images, likes, public/private toggle)

## Environment Variables
See .env.example for all required keys.
Never commit .env.local to Git.

## Known Decisions
- Prisma client uses `prisma-client` provider with output to `app/generated/prisma`, imported via `@db` path alias
- Seeding uses `tsx prisma/seed.ts` (not ts-node) due to Prisma 7 ESM client
- Auth uses mock dev user locally (NODE_ENV !== 'production'). Clerk to be wired in lib/auth.ts before go-live
- DIRECT_URL must be set in .env.local for migrations and db push (Neon requirement)
