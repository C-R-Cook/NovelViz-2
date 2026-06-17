# Authentication workflow

NovelViz uses [Clerk](https://clerk.com) for accounts. The app DB (`User` row keyed by `clerkId`) is synced via webhook and a server-side fallback on first request.

## Production URLs

| URL | Purpose |
|-----|---------|
| `/login` | Clerk sign-in |
| `/register` | Clerk sign-up (new accounts) |
| `/sign-in` | Legacy redirect → `/login` or app home if already signed in |
| `/sign-up` | Legacy redirect → `/register` |
| `/auth/after` | Post–Clerk redirect: `/onboarding` or `/library` |
| `/onboarding` | Username + profile (required before reader app) |

Clerk `SignIn` / `SignUp` components use `forceRedirectUrl="/auth/after"`.

## Production flows

### New user

1. `/register` → Clerk sign-up  
2. `/auth/after` → `/onboarding` (no username yet)  
3. Complete onboarding → `/library`

### Returning user

1. `/login` → Clerk sign-in  
2. `/auth/after` → `/library` if username exists, else `/onboarding`

### Sign out

Account menu → **Sign out** → Clerk session cleared → `/`.

### Email change (account page)

Users change email inline on **Profile** via Clerk (`createEmailAddress` → verify code → promote primary → remove old). Neon `User.email` syncs on the `user.updated` webhook (not via `/api/account` PATCH).

- **Reverification:** Sensitive steps use Clerk `useReverification()` — a Clerk modal confirms identity (e.g. code to current email). Without it, `createEmailAddress` returns **403**.
- **Component:** [`components/account/email-change-section.tsx`](../components/account/email-change-section.tsx)
- **Dev role switcher:** UI visible; **Change email** disabled until signed in with Clerk

### DB user creation

- **Primary:** Clerk webhook `user.created` → `POST /api/webhooks/clerk`  
- **Updates:** `user.updated` syncs email/name; `user.deleted` removes the DB user  
- **Fallback:** `ensureDbUserForClerk()` on first `getCurrentUser()` if webhook missed

Ensure `CLERK_WEBHOOK_SECRET` is set in production.

### Webhook URL (avoid 307 failures)

Clerk (via Svix) sends `POST` requests and **does not replay the body** if your server responds with a redirect. A `307` in the Clerk dashboard usually means the request never reached the route handler.

**Production check (June 2026):** `https://novelviz.com/...` returns **307 → `https://www.novelviz.com/...`**. The Clerk endpoint must use **`www`**:

`https://www.novelviz.com/api/webhooks/clerk`

Configure the endpoint **exactly**:

| Check | Correct |
|-------|---------|
| Path | `https://www.novelviz.com/api/webhooks/clerk` — **no** trailing slash |
| Host | **`www.novelviz.com`** — not `novelviz.com` (apex redirects with 307) |
| Protocol | `https` in production |
| Events | Subscribe to `user.created`, `user.updated`, and `user.deleted` |

Quick test from a terminal (unsigned POST should return **400**, not 307):

```bash
curl -sI -X POST https://www.novelviz.com/api/webhooks/clerk
```

The app rewrites `/api/webhooks/clerk/` → `/api/webhooks/clerk` internally and marks `/api/webhooks/*` as public in `proxy.ts` so Clerk middleware does not intercept webhook POSTs.

## Local development

### Real Clerk account

Same as production. Do not use the dev role switcher while signed in to Clerk (switcher is disabled with a hint).

### Dev impersonation (no Clerk)

1. Sign out of Clerk (or never sign in).  
2. Pick a user in the **Dev user** control (bottom-right).  
3. Open `/library`, `/admin`, etc. Middleware allows access when `dev_user_id` cookie is set (non-production only).

`getCurrentUser()` in development: **Clerk session wins** if present; otherwise dev cookie.

### Sign out (dev)

Clears dev cookie + redirects home. If Clerk is signed in, also runs Clerk sign-out.

## Deploy checklist

- [ ] Clerk production instance + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`  
- [ ] Webhook endpoint → `https://www.novelviz.com/api/webhooks/clerk` (must use `www`; apex `novelviz.com` 307-redirects and breaks Svix POSTs)  
- [ ] `CLERK_WEBHOOK_SECRET` in env  
- [ ] Smoke test: sign-up → onboarding → library  
- [ ] Smoke test: sign-in → library (existing user with username)  
- [ ] Smoke test: sign-out → landing shows Sign In  

Dev switcher and proxy dev bypass are **not** active when `NODE_ENV=production`.
