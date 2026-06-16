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

### DB user creation

- **Primary:** Clerk webhook `user.created` → `POST /api/webhooks/clerk`  
- **Updates:** `user.updated` syncs email/name; `user.deleted` removes the DB user  
- **Fallback:** `ensureDbUserForClerk()` on first `getCurrentUser()` if webhook missed

Ensure `CLERK_WEBHOOK_SECRET` is set in production.

### Webhook URL (avoid 307 failures)

Clerk (via Svix) sends `POST` requests and **does not replay the body** if your server responds with a redirect. A `307` in the Clerk dashboard usually means the request never reached the route handler.

Configure the endpoint **exactly**:

| Check | Correct |
|-------|---------|
| Path | `https://<your-domain>/api/webhooks/clerk` — **no** trailing slash |
| Host | Use the same host users visit (`www` vs apex must match; Vercel may 307 between them) |
| Protocol | `https` in production |
| Events | Subscribe to `user.created`, `user.updated`, and `user.deleted` |

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
- [ ] Webhook endpoint → `https://<prod-domain>/api/webhooks/clerk` (no trailing slash; match `www` if the site uses it) with `user.created`, `user.updated`, `user.deleted`  
- [ ] `CLERK_WEBHOOK_SECRET` in env  
- [ ] Smoke test: sign-up → onboarding → library  
- [ ] Smoke test: sign-in → library (existing user with username)  
- [ ] Smoke test: sign-out → landing shows Sign In  

Dev switcher and proxy dev bypass are **not** active when `NODE_ENV=production`.
