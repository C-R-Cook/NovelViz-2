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

* **Framework:** Next.js (app router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Auth:** Clerk
* **ORM:** Prisma
* **Database:** Neon (Postgres) with pgvector extension for semantic search
* **Hosting:** Vercel
* **AI — Q\&A:** Anthropic API
* **AI — Image Generation:** fal.ai or Replicate
* **Package Manager:** npm

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

## Database Schema (Prisma)

Models and their purpose:

* **Book** — catalogue entry, has a status enum (draft | published | unlisted)
* **Chapter** — belongs to Book, has sequenceNumber and rawText
* **Chunk** — segment of a Chapter, stores embedding vector for semantic search,
also stores bookId directly for faster filtering
* **User** — reader account, stores country, ageRange, genrePreferences
* **UserBook** — join between User and Book, represents a user's library
* **ReadingProgress** — tracks which chapter a user is currently on for a given book.
This is the gating key for all AI features.
* **Query** — a Q\&A interaction, stores chapterNumberAtTime as a snapshot
(not a foreign key) so context is auditable even after progress updates
* **GeneratedImage** — an image generation interaction, stores chapterNumberAtTime
as a snapshot, full prompt, user prompt, all generation parameters,
and a isPublic flag for the gallery
* **BookRequest** — a user request for a book not yet in the catalogue

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
width, height, sampler, negativePrompt, model) plus a rawParameters JSON field as a
catch-all for model-specific options. This supports a future power user / advanced mode.

### Book Ingestion Pipeline

Books are ingested by an admin only. The pipeline:

1. Admin uploads raw text
2. System splits into chapters
3. Chapters split into chunks (\~500 tokens with overlap)
4. Each chunk is embedded and stored with its vector
5. Book status set to draft for admin review before publishing

This is a background process, not an inline API call.

### User Roles

* **Reader** — standard authenticated user
* **Admin** — full catalogue and user management (you)
* **Publisher** — future role, not yet implemented

## Naming Conventions

* Files and folders: kebab-case
* React components: PascalCase
* Functions and variables: camelCase
* Database models: PascalCase (Prisma convention)
* API routes: /api/\[resource]/\[id] REST convention

## What is NOT Built Yet

1. Project scaffold (Next.js, Prisma, Clerk, Neon, Tailwind)

## Build Order

1. Project scaffold (Next.js, Prisma, Clerk, Neon, Tailwind)
2. Database schema and migration
3. Auth (sign up, login, user record created in DB)
4. Catalogue pages (read only, public)
5. Library (add/remove books, dashboard)
6. Reading Progress (chapter selector, save and retrieve)
7. Book ingestion (admin, chunking, embeddings)
8. Q\&A feature
9. Image generation feature
10. Gallery (public images, likes, public/private toggle)

## Environment Variables

See .env.example for all required keys.

