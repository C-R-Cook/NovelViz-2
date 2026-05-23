# Database environments (Neon + Vercel + local)

Use **separate Postgres databases** for production and local development. This project reads **`DATABASE_URL`** everywhere (Prisma app, CLI scripts, migrations). Optional **`DIRECT_URL`** is used for migrations and some scripts when set (see `prisma.config.ts`).

## 1. Neon: two branches

In the [Neon console](https://console.neon.tech) for your project:

| Branch | Purpose |
|--------|---------|
| **production** (or `main`) | Live site data — real users, catalogue, ingest results |
| **development** | Local dev, experiments, `prisma db seed`, Gutenberg CLI tests |

**Create dev from prod (one-time):**

1. Branches → **Create branch** → parent: `production` → name: `development`.
2. Open each branch → **Connection details** → copy **pooled** and **direct** URLs.

Neon URLs look like:

```text
# Pooled (use for DATABASE_URL in app + serverless)
postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require

# Direct (use for DIRECT_URL — migrations, long scripts)
postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

---

## 2. Vercel environment variables

Project → **Settings** → **Environment Variables**.

Set each variable for the right **environment** only (checkboxes: Production / Preview / Development).

### Production (live site only)

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **production** branch — **pooled** connection string |
| `DIRECT_URL` | Neon **production** branch — **direct** connection string (recommended for `migrate deploy`) |
| `CLERK_SECRET_KEY` | Clerk **production** instance |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk **production** publishable key |
| `CLERK_WEBHOOK_SECRET` | Webhook signing secret for prod Clerk → `https://<your-domain>/api/webhooks/clerk` |
| … | Other prod secrets (`OPENAI_API_KEY`, `CLOUDINARY_URL`, etc.) |

Do **not** attach the dev Neon branch to Production.

### Preview (optional third DB)

Either:

- **A)** Use a small Neon **preview** branch and set `DATABASE_URL` / `DIRECT_URL` only on **Preview**, or  
- **B)** Leave Preview without DB vars and accept preview builds won’t run the app against a DB, or  
- **C)** Point Preview at **development** branch (never at production).

### Development (Vercel CLI / `vercel dev`)

Used when you run `vercel env pull` for local overrides from the team project:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **development** branch — pooled |
| `DIRECT_URL` | Neon **development** branch — direct |
| `CLERK_*` | Clerk **development** instance keys (not production) |

---

## 3. Local: `.env.local`

Next.js loads `.env.local` over `.env` (see `prisma.config.ts`). **Never commit** this file.

Create `.env.local` in the repo root:

```env
# ─── Database (Neon DEVELOPMENT branch only) ───
DATABASE_URL="postgresql://...@ep-xxxx-dev-pooler....neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://...@ep-xxxx-dev....neon.tech/neondb?sslmode=require"

# Optional: Neon console → Project Settings → project id (admin storage UI)
NEON_PROJECT_ID="your-neon-project-id"

# ─── Clerk (DEVELOPMENT instance — dashboard → API Keys) ───
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...   # from dev Clerk webhook endpoint

# ─── App secrets (dev copies or separate dev keys) ───
OPENAI_API_KEY=...
CLOUDINARY_URL=...
# Scripts (Gutenberg ingest on dev DB):
GUTENBERG_ADMIN_USER_ID=dev_user_admin

# ─── Everything else you already use locally ───
# BETA_MODE=true
# etc.
```

**Rule:** If `DATABASE_URL` in `.env.local` is the dev branch, `npm run dev` and all `npx tsx scripts/...` commands only touch dev data.

---

## 4. Pull Vercel “Development” env into local (optional)

If variables are stored in Vercel under the **Development** environment:

```bash
vercel link
vercel env pull .env.local --environment=development
```

Then **verify** `DATABASE_URL` in the pulled file is the **dev** branch, not production. Edit if needed.

---

## 5. First-time setup on the dev database

After `DATABASE_URL` / `DIRECT_URL` point at the **development** branch:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Seed creates `dev_user_admin`, readers, partners, sample books, etc. (`prisma/seed.ts`).

Your real Clerk user (CH) will get a row on **first sign-in** against whichever DB `DATABASE_URL` points at — so sign in locally only after dev DB is configured.

---

## 6. Vercel build command (production migrations only)

Recommended **Build Command** override:

```bash
if [ "$VERCEL_ENV" = "production" ]; then npx prisma migrate deploy; fi && next build
```

| Environment | Migrations | Build |
|-------------|------------|--------|
| Production | `migrate deploy` on **prod** DB | `next build` |
| Preview | skipped (unless you add preview DB + conditional) | `next build` |
| Local | you run `migrate deploy` / `migrate dev` against **dev** | `npm run dev` |

Install Command can stay `npm install` (or your existing override).

---

## 7. Clerk + webhooks (two instances)

| | Production | Local dev |
|--|------------|-----------|
| Clerk dashboard | Production application | Development application |
| Keys in env | Vercel **Production** | `.env.local` |
| Webhook URL | `https://<prod-domain>/api/webhooks/clerk` | ngrok or Clerk dev tunnel → `http://localhost:3000/api/webhooks/clerk` |

Same email can exist in both Clerk instances; they have **different** `clerkId` values. Your prod user row stays on prod DB; dev sign-in creates/updates a row on dev DB.

---

## 8. Day-to-day checklist

| Task | Database |
|------|----------|
| `npm run dev` | Dev (`.env.local`) |
| `npx prisma migrate dev` | Dev |
| `npx tsx scripts/gutenberg-ingest.ts` | Dev |
| Dev role switcher | Dev |
| Vercel production deploy | Prod only |
| Real user traffic | Prod only |

**Never** put the production `DATABASE_URL` in `.env.local`.

---

## 9. Copying prod → dev (optional, rare)

If you need prod-like data on dev:

1. Neon: branch reset from parent, or logical dump/restore (Neon docs).
2. Prefer **not** copying prod users’ PII to dev unless required.
3. Usually **seed + fresh ingest on dev** is enough.

---

## Quick reference

```text
Production site  →  Vercel Production env  →  Neon production branch
Local npm run dev →  .env.local             →  Neon development branch
```

Related: [Authentication workflow](./auth-workflow.md).
