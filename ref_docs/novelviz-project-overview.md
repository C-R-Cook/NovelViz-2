# NovelViz — Project Overview

## What is NovelViz

NovelViz is a web application that provides chapter-gated AI features for book readers. Users register, browse a catalogue of books, and add books they own to their personal library. They set their current chapter, then unlock two core AI features: asking questions about the book and generating images of characters, places, and scenes.

Every AI response is strictly limited to content from chapters the user has already reached — no spoilers, ever.

**The core insight:** When a reader asks an AI about a book, it should only reference content up to the chapter they have reached. This concept was conceived after the founder experienced an AI spoiling a book mid-read.

**Users never read books on the site.** They tell NovelViz what they own in the real world. NovelViz provides the intelligence layer on top of that, avoiding ebook licensing complexity entirely.

---

## Business Model

- **Freemium subscriptions** — core features free, premium tier for additional image generations and features
- **Publisher/partner advertising** — targeted advertising to readers based on genre preferences, age, and reading behaviour
- **Affiliate/retailer links** — commission from links to Amazon, Bookshop.org and other retailers on book pages
- **Publisher partnerships** — backed by real demand data (library adds, queries, image generations per book)

The platform serves three audiences simultaneously:
- **Readers** — spoiler-free AI companion for their reading
- **Publishers and authors (Partners)** — engagement data, marketing reach, retailer link revenue
- **Advertisers** — highly targeted audience of active readers with known genre preferences

---

## User Roles

### Reader
Standard authenticated user. Can browse the catalogue, add books to their library, set reading progress, use Q&A and image generation features, and share images to the public gallery.

### Partner
Authors, publishers, resellers, or anyone with content permissions. Can upload books, manage their catalogue, view engagement stats, and submit books for review. Partners are also readers — they can switch between Reader mode and Partner mode within the same account.

### Admin
Full platform control. Can moderate book submissions, manage all books and users, view site-wide statistics, and approve or reject partner submissions.

**Role hierarchy:** Reader ⊂ Partner ⊂ Admin. Every user is a reader. Partners get reader + partner capabilities. Admins get everything.

---

## Core Features

### Chapter-Gated Q&A
Users ask questions about the book in natural language. The system retrieves the most relevant passages from chapters the user has read (using semantic search), passes them to Claude as context, and returns an answer that cannot reference anything beyond the user's current chapter.

### Chapter-Gated Image Generation
Users describe a scene, character, or moment. The system:
1. Extracts the primary visual subject from the request
2. Retrieves relevant book descriptions via semantic search (chapter-gated)
3. Enriches the prompt using Claude to incorporate authentic visual details from the text
4. Generates the image via fal.ai

### Public Gallery
Community showcase of AI-generated images. Images are spoiler-blurred for viewers who haven't reached the chapter the image was generated at. Three carousels: From Your Library, Trending Now, Discover.

### Discover Page
Browseable book catalogue with featured carousel, genre filter pills, and a searchable browse section. Books are served with real cover images extracted from their EPUBs.

### Partner Dashboard
Partners see engagement stats for their books: reader counts, queries, image generations, age range and genre breakdowns, chapter engagement heatmaps — all rendered as interactive charts.

### Book Moderation Workflow
Partners upload books → system ingests EPUB → partner reviews chapters → partner submits for review → admin approves/rejects with reason → book published → partner can toggle visibility.

---

## Technology Stack

### Framework
**Next.js 16** (App Router) with TypeScript. All pages use server components where possible, with client component islands for interactivity.

### Styling
**Tailwind CSS** with a custom CSS design token system. All colours are defined as CSS custom properties (`var(--accent)`, `var(--bg-surface)` etc) enabling palette switching. Five palettes available in development: Midnight Library, Gothic Noir, Candlelight, Moonlight Silver, Crimson.

### Authentication
**Clerk** — handles sign up, sign in, and user webhooks. A `user.created` webhook syncs new Clerk users to the Neon database. In local development, a mock user system bypasses Clerk entirely (three separate DB records per role). Clerk is wired in for production via `lib/auth.ts`.

### Database
**Neon PostgreSQL** (serverless) with the **pgvector** extension for storing and querying 1536-dimension embedding vectors. Accessed via **Prisma 7** ORM.

Prisma client is generated to `app/generated/prisma` and imported via the `@db` TypeScript path alias. Seeding uses `tsx` (not ts-node) for ESM compatibility.

### Image Storage
**Cloudinary** — stores book cover images. Covers are automatically extracted from EPUB files during ingestion and uploaded to Cloudinary under `novelviz/covers/[bookId]`. All covers are transformed to a consistent 2:3 portrait ratio using `crop: "fit"`.

### AI Providers
- **OpenAI** (`text-embedding-3-small`) — text embeddings for semantic search
- **Anthropic Claude** — Q&A responses and image prompt enrichment
- **fal.ai** (`flux/schnell`) — image generation

See `NOVELVIZ_AI_SYSTEMS.md` for full AI architecture detail.

### Hosting
**Vercel** — `dev` branch deploys to a preview URL (staging), `main` branch deploys to production.

---

## Architecture

### Route Groups
```
app/
├── (public)/         → Unauthenticated routes
│   ├── books/        → /books (Discover page)
│   ├── gallery/      → /gallery
│   ├── faq/          → /faq
│   ├── contact/      → /contact
│   ├── privacy/      → /privacy
│   └── terms/        → /terms
│
├── (reader)/
│   └── (app)/        → Authenticated reader routes (onboarding gate applied)
│       ├── library/  → /library
│       ├── dashboard/→ /dashboard
│       ├── reader/   → /reader/[bookId]
│       ├── account/  → /account
│       └── onboarding/ → /onboarding
│
├── (partner)/        → Partner routes
│   └── partner/
│       ├── books/    → /partner/books/new, /partner/books/[id]
│       └── books/[id]/stats/ → per-book analytics
│
├── admin/            → Admin routes
│   ├── books/        → /admin/books, /admin/books/[id]
│   └── requests/     → /admin/requests
│
└── api/              → API route handlers
```

### Key Architectural Decisions

**No in-app reading** — users declare book ownership and track progress only. This significantly reduces legal and licensing exposure. NovelViz is a companion, not an ebook reader.

**Integer snapshots for chapterNumberAtTime** — `Query.chapterNumberAtTime` and `GeneratedImage.chapterNumberAtTime` are stored as integers, not foreign keys to ReadingProgress. This preserves an accurate audit trail regardless of future progress changes.

**Soft delete on books** — books have a `deletedAt` timestamp field. Deleting a book sets this field rather than removing the record, preventing orphaned user data and enabling restoration from admin.

**EPUB-first ingestion** — books are ingested from EPUB files using JSZip to parse the zip, reading `toc.ncx` for exact chapter anchors. This gives precise chapter boundaries without regex guessing. Plain text (`.txt`) is supported as a fallback.

**pgvector for semantic search** — chunk embeddings are stored in Postgres alongside book content, enabling similarity search in the same database transaction as the chapter gating filter. No separate vector database required.

**Design tokens** — all colours use CSS custom properties rather than hardcoded Tailwind classes. This enables palette switching and ensures consistency across the entire UI.

**Dev role switcher** — a floating dev-only widget allows switching between six dev user accounts (two readers, two partners, one admin) without logging in and out. Each dev user is a real database record with independent library, progress, and image history.

---

## Database Schema (Summary)

### Core Models

**User**
- `clerkId` — links to Clerk auth
- `username` — unique, public-facing (used in gallery, not real name)
- `name`, `email` — private
- `role` — `reader | partner | admin`
- `gender`, `ageRange`, `country`, `genrePreferences`
- `subscribedToMailingList`

**Book**
- `title`, `author`, `description`
- `genre` — `BookGenre` enum (controlled list of 15 genres)
- `status` — `BookStatus` enum (draft → pending_review → published etc)
- `ownerId` — links to partner User who uploaded it
- `coverImageUrl` — Cloudinary URL
- `isPublicDomain`
- `deletedAt` — soft delete

**Chapter**
- Belongs to Book
- `sequenceNumber` — ordered position in the book
- `title`, `rawText`

**Chunk**
- Belongs to Chapter and Book (bookId denormalised for faster pgvector filtering)
- `content` — text segment (~500 tokens)
- `embedding` — 1536-dimension vector

**UserBook** — join between User and Book, tracks library membership

**ReadingProgress** — tracks which chapter a user is currently on for a given book

**Query** — saved Q&A interactions with token usage for cost monitoring

**GeneratedImage** — saved image generations with prompts, token usage, and public/private flag

**BookRequest** — user-submitted requests for books not yet in the catalogue

### Enums
- `BookStatus`: `draft | processing | ready_for_review | pending_review | published | unlisted | rejected`
- `BookGenre`: `fantasy | horror | romance | adventure | mystery | science_fiction | historical_fiction | literary_fiction | thriller | childrens_fiction | classic_literature | gothic | crime | biography | short_stories`
- `UserRole`: `reader | partner | admin`
- `Gender`: `male | female | non_binary | other | prefer_not_to_say`
- `SpoilerProtection`: `INHERIT | PROTECTED | UNLOCKED`

---

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Anthropic Claude API client |
| `openai` | OpenAI API client (embeddings) |
| `@fal-ai/client` | fal.ai image generation client |
| `cloudinary` | Cloudinary image upload and management |
| `@clerk/nextjs` | Clerk authentication |
| `@prisma/adapter-neon` | Neon serverless Postgres adapter |
| `jszip` | EPUB file parsing (EPUBs are zip files) |
| `fast-xml-parser` | OPF and NCX XML parsing during EPUB ingestion |
| `react-markdown` | Renders Claude Q&A responses with markdown formatting |
| `recharts` | Data visualisation charts on partner dashboard |

---

## Book Ingestion Pipeline

Books are ingested from EPUB files by admin or partner users. The pipeline:

1. **Upload** — EPUB file uploaded via admin/partner book detail page
2. **Cover extraction** — cover image extracted from EPUB manifest and uploaded to Cloudinary
3. **Genre detection** — Gutenberg subject tags mapped to `BookGenre` enum via OpenAI GPT-4o-mini
4. **Chapter parsing** — `toc.ncx` navMap read for exact chapter anchors; HTML split at anchor points; Gutenberg boilerplate filtered automatically
5. **Chunking** — each chapter split into ~500 token chunks with ~50 token overlap
6. **Embedding** — each chunk embedded via OpenAI `text-embedding-3-small` and stored in pgvector
7. **Status update** — book status set to `ready_for_review`

After ingestion, admin can review chapters via the Chapter Manager (merge, delete, rename). If chapters are edited, Finalise re-runs the chunking and embedding pipeline.

---

## Development Workflow

- **Claude** provides architecture guidance, planning, and writes all Cursor prompts
- **Cursor AI** handles hands-on coding — prompts are pasted into Cursor Composer
- Use **Plan mode before Agent mode** in Cursor for complex multi-file tasks
- Commit after each session before switching machines (laptop ↔ desktop)
- `CURSOR.md` maintained as persistent project context across Cursor sessions
- `NOVELVIZ_AI_SYSTEMS.md` documents the full AI architecture
- `dev` branch for all active development; merge to `main` for production releases

### Environment Variables
```
DATABASE_URL                        # Neon pooled connection string
DIRECT_URL                          # Neon direct connection (required for migrations)
CLERK_SECRET_KEY                    # Clerk server-side key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # Clerk client-side key
CLERK_WEBHOOK_SECRET                # Clerk webhook signing secret
ANTHROPIC_API_KEY                   # Anthropic API key
ANTHROPIC_MODEL                     # e.g. claude-sonnet-4-5
OPENAI_API_KEY                      # OpenAI API key
CLOUDINARY_URL                      # Cloudinary connection URL
FAL_API_KEY                         # fal.ai API key
```

---

## Known Limitations and Carry-Forward Items

### Must resolve before production launch
- **Clerk auth not wired** — `lib/auth.ts` uses mock dev users locally. Wire `auth()` from `@clerk/nextjs/server` before go-live. TODO comment is in place.
- **Neon free tier limits** — 0.5GB storage. Upgrade to Launch plan ($5/month) before beta to remove hard limits.
- **`prisma migrate dev` shadow DB issue** — use `npx prisma migrate deploy` for applying new migrations locally. Baseline migration applied but shadow DB replay still fails.

### Planned features (V2)
- **Entity extraction** — characters, locations, objects extracted per chapter during ingestion to improve image generation accuracy and character consistency
- **Book forum** — per-book community forum with Claude-powered spoiler detection on post submit
- **Batch Gutenberg ingestion** — automated ingestion via Gutendex API with background job queue (QStash or Trigger.dev)
- **Retailer links** — Amazon/Bookshop.org affiliate links on book and reader pages
- **Admin statistics page** — site-wide cost monitoring and usage graphs
- **Email integration** — contact form sending via Resend; mailing list via Loops
- **Character consistency** — entity extraction feeding into image generation for consistent character appearance across generations
- **Non-chapter content handling** — poems, prologues, interludes currently dropped during EPUB parsing

### Known edge cases
- EPUB uploads >4.5MB hit Vercel's function payload limit — use no-images EPUB versions from Gutenberg. Future fix: direct browser-to-Cloudinary upload.
- fal.ai image URLs are temporary CDN URLs and may expire. Long-term fix: re-upload generated images to Cloudinary.
- Character age/appearance inconsistency in image generation — a character described as a child early in a book may generate child images even at later chapters if early descriptions dominate the retrieved chunks.
