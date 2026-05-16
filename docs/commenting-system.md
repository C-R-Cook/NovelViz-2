# Commenting system (frontend and backend)

This document describes how image comments work end-to-end: storage, automated spoiler scanning, reader reports, visibility rules per viewer, API routes, and admin moderation queues.

## Data model

Comments live on **generated gallery images** (`Comment.imageId` → `GeneratedImage`).

| Field | Purpose |
|--------|---------|
| `content` | Up to 500 characters. |
| `status` | `VISIBLE` · `HIDDEN_SPOILER` · `PENDING_CONTENT_REVIEW` · `DELETED` (soft delete). |
| `spoilerGateChapter` | Chapter used for **spoiler gating** (from AI scan or image chapter). |
| `spoilerModerationAt` | Set when an **admin confirms** spoiler moderation (“keep gated” path). Until then, hidden spoiler comments are still in the **admin spoiler queue**. |
| `spoilerScanDebug` | Optional JSON debug payload from the spoiler scan (also used in dev tooling). |

`DELETED` rows are excluded from the public comment list API; other code paths treat them as gone.

## Status meanings (high level)

- **`VISIBLE`**: Normal public comment (subject to per-viewer spoiler UI if it were ever hidden then reinstated—reinstate clears gate fields).
- **`HIDDEN_SPOILER`**: Automated scan (or author self-confirm—see PATCH) marked this as spoiler-like. Visibility is resolved in **`getCommentViewerPresentation`** (see below). If `spoilerModerationAt` is null, the comment is **pending admin spoiler review**.
- **`PENDING_CONTENT_REVIEW`**: A **reader flagged** the comment for inappropriate content. The author still sees it with a “under review” notice; others do not see it until an admin restores or removes it.
- **`DELETED`**: Removed; not listed.

## Core backend rule: “what does this viewer see?”

All listing and flag permission logic funnels through **`getCommentViewerPresentation`** in `lib/comment-viewer-presentation.ts` (re-exported as `lib/comment-visibility.ts`).

Inputs include:

- Viewer (`User` id + `role`, or null).
- Comment `status`, `userId`, `spoilerGateChapter`, `spoilerModerationAt`.
- Image chapter number, image owner user id.
- Reader’s **reading progress** (`currentChapterNumber`) and **spoiler settings** (`userBookSpoiler`, `globalSpoilerProtection`).
- `sessionOverride` (gallery “reveal” session flag—see API).
- Optional spoiler scan debug for inferring gate chapter.

Outputs drive the API and UI:

- **`listVisible`**: Include this comment in the list for this viewer?
- **`revealContent`**: Send plaintext `content` to the client?
- **`spoilerLocked`**, **`lockMessage`**, **`chapterGap`**: Locked placeholder for readers behind the spoiler gate.
- **`showAuthorReview`**, **`showPendingSpoilerNotice`**, **`showContentReviewNotice`**, **`showAuthorSpoilerConfirmedNotice`**: Author/reader messaging in `GalleryImageComments`.

Important behaviors to remember:

1. **`PENDING_CONTENT_REVIEW`**: Only **admin**, **session override**, or the **comment author** get `listVisible`; for the author, `showContentReviewNotice` is set.
2. **`HIDDEN_SPOILER`**: Admins and session override always see full content. The **author** always sees content, with `showAuthorReview` until an admin sets `spoilerModerationAt`; after confirm-keep, `showAuthorSpoilerConfirmedNotice` applies. Other readers see either a **lock** (behind gate, pre-admin-confirm), **pending spoiler notice** (past gate, scan not admin-confirmed), **lock “under review”** for **image owner** edge case, or full text after they pass the spoiler gate (post admin-confirm).

Spoiler gate math for “behind gate” uses **`isBehindSpoilerCommentGate`** in `lib/gallery-spoiler.ts` (based on `currentChapter` vs `spoilerGateChapter`; no progress ⇒ treat as behind gate).

## Automated spoiler scan (after post)

Implementation: **`lib/comment-scan.ts`** (`scanCommentForSpoilers`).

1. New comments are created as **`VISIBLE`** (`POST /api/comments`).
2. If spoiler-scan debug mode is on, a “pending” debug record may be written first (`setCommentSpoilerScanPending`).
3. Scan calls **`getAnthropicTextResponse`** with a strict JSON-shaped prompt. Parsed result:
   - **Not a spoiler**: debug updated; comment stays `VISIBLE`.
   - **Spoiler**: status → `HIDDEN_SPOILER`, **`spoilerGateChapter`** set from model or image chapter; **`spoilerScanDebug`** updated; **`COMMENT_HIDDEN_PENDING`** notification to the author.

Whether the scan runs **inline or in `after()`** depends on `shouldAwaitCommentSpoilerScan()` (`lib/comment-spoiler-scan-debug.ts`).

Re-scan: After author **reword** back to visible (non–content-review path) or admin **restore** from content review, **`scanCommentForSpoilers`** is scheduled again.

## HTTP API

Base path: **`/api/comments`**.

### `GET /api/comments?imageId=…&session=true|false`

- **`imageId`** required.
- **`session=true`**: Sets `sessionOverride` in presentation (gallery parity when the app has unlocked spoilers for this session).
- Resolves viewer via session + **`resolveDbUserFromSession`**; loads image (published + public for non-admin; admins get broader access).
- Loads non-deleted comments; filters by `presentation.listVisible`.
- Response rows include flags the UI needs: **`canEdit`**, **`canDelete`**, **`canFlag`**, **`canAdminModerateContent`**, **`canAdminModerateSpoiler`**, **`canAdminConfirmSpoilerGated`**, plus presentation-derived booleans/strings.
- **`canFlag`**: Not your comment; status visible or hidden spoiler **and** `revealContent` (you only report what you could read).
- Marked **`dynamic`** so lists stay fresh.

### `POST /api/comments`

- Auth required; body `{ imageId, content }` (trimmed, 1–500 chars).
- Creates `VISIBLE` comment on a **public** image of a **published** book.
- Triggers spoiler scan flow as above.

### `PATCH /api/comments/[commentId]`

JSON body: **`action`** ∈ `reword` | `reinstate` | `confirm_spoiler` | `moderate_content`, plus optional fields.

| Action | Who | Effect |
|--------|-----|--------|
| **`reword`** | Author | Updates text. If `PENDING_CONTENT_REVIEW`, only content changes (status unchanged). Otherwise resets to `VISIBLE`, clears gate fields, re-runs spoiler scan. |
| **`reinstate`** | Author or admin | From `HIDDEN_SPOILER` → `VISIBLE`, clears gates. Admin triggers author **`COMMENT_RELEASED`** notification; author triggers admin **`COMMENT_REINSTATED`**. |
| **`confirm_spoiler`** | **Admin** | On `HIDDEN_SPOILER`: `disposition` **`delete`** → soft delete + **`COMMENT_SPOILER_REMOVED`**; **`keep`** → sets **`spoilerModerationAt`** + **`COMMENT_SPOILER_CONFIRMED_GATED`**. |
| **`confirm_spoiler`** | **Author** (non-admin) | Visible comment → `HIDDEN_SPOILER` (self-flag path; no disposition). |
| **`moderate_content`** | **Admin only** | On `PENDING_CONTENT_REVIEW`: **`delete`** → delete + notify; **`restore`** → `VISIBLE`, clear gates, re-scan + notify **`COMMENT_FLAGGED_RESTORED`**. |

### `DELETE /api/comments/[commentId]`

- Comment author or admin. Soft-deletes (`DELETED`). If admin deletes someone else’s comment, author gets **`COMMENT_FLAGGED_REMOVED`**.

### `POST /api/comments/[commentId]/flag`

- Reader reports **inappropriate content**. Validates the viewer **`revealContent`** matches what they should see (same presentation test as GET).
- Sets status to **`PENDING_CONTENT_REVIEW`**; notifies comment author (**`COMMENT_REPORTED_TO_AUTHOR`**) and all admins (**`COMMENT_FLAGGED_FOR_MODERATION`**).

## Admin UI (dashboard)

Two queues (see **`app/(reader)/(app)/dashboard/`**):

1. **Spoiler comments** (`SpoilerCommentsQueue` + `lib/admin-spoiler-comments-queue.ts`): `HIDDEN_SPOILER` and **`spoilerModerationAt == null`**. Actions call **`PATCH`** with **`reinstate`** or **`confirm_spoiler`** (`keep` / `delete`). Preview uses **`SpoilerReviewGalleryModal`** with **`GalleryImageComments`**.

2. **Flagged comments** (`FlaggedCommentsQueue` + `lib/admin-flagged-comments-queue.ts`): `PENDING_CONTENT_REVIEW`. Actions call **`PATCH`** with **`moderate_content`** (`restore` / `delete`).

Counts on the dashboard come from the same `count*` helpers in those libs.

## Frontend (gallery)

Primary UI: **`components/gallery/gallery-image-comments.tsx`**, embedded in:

- **`app/(public)/gallery/gallery-client.tsx`** and **`gallery-book-client.tsx`** (modal sidebar when the image is unlocked),
- **`components/gallery/spoiler-review-gallery-modal.tsx`** (admin preview).

Behavior:

- Fetches **`GET /api/comments`** with `credentials: "include"` and `cache: "no-store"`.
- Passes **`sessionCommentsUnlocked`** when the parent enables gallery session reveal (`session=true` on the query).
- Renders rows from API flags: spoiler overlays, pending notices, author review copy, admin icon toolbars (`canAdminModerateContent` / `canAdminModerateSpoiler`), edit/delete/flag as allowed.
- **Post** uses `POST /api/comments`; **edit** uses `PATCH` + `action: "reword"`; **delete** uses `DELETE`; **flag** uses `POST .../flag`; admin actions use `PATCH` with the actions above.

## Notifications

Comment-related `NotificationType` values (see `prisma/schema.prisma`) include hidden spoiler pending, reinstate, content flag/reported, flagged restore/remove, release, spoiler removed, spoiler confirmed gated. **`lib/notifications.ts`** is used from **`comment-scan.ts`**, **`[commentId]/route.ts`**, and **`flag/route.ts`**.

---

## File index (quick reference)

| Area | Path |
|------|------|
| Presentation rules | `lib/comment-viewer-presentation.ts`, `lib/comment-visibility.ts` |
| Spoiler scan | `lib/comment-scan.ts` |
| Chapter / gate helpers | `lib/gallery-spoiler.ts` |
| List + create | `app/api/comments/route.ts` |
| Edit / admin actions / delete | `app/api/comments/[commentId]/route.ts` |
| Reader flag | `app/api/comments/[commentId]/flag/route.ts` |
| Session user → DB user | `lib/resolve-db-user-from-session.ts` |
| Gallery comments UI | `components/gallery/gallery-image-comments.tsx` |
| Admin spoiler queue data | `lib/admin-spoiler-comments-queue.ts` |
| Admin flagged queue data | `lib/admin-flagged-comments-queue.ts` |
