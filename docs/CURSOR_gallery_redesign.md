# NOVELVIZ — Gallery `/gallery` Redesign: Book-Grouped Rows with Genre Filtering

## Context

Read `NOVELVIZ_REFERENCE_v8.md`, `CURSOR.md`, and `docs/gallery-system.md` before starting. The gallery page lives at `app/(public)/gallery/`. Study the existing `gallery-client.tsx`, `gallery-redesign.css`, and `app/(public)/gallery/page.tsx` carefully before writing any code.

Do not touch `app/(public)/gallery/[bookId]/` or any of its supporting files — that page is unchanged.

---

## What We're Building

We are replacing the main gallery layout from two masonry grids (FROM YOUR LIBRARY + FEATURED) to a **book-grouped horizontal row structure** with **genre pill filtering**. The FEATURED section is removed entirely — `getFeaturedImageIdsForDisplay` will no longer be called from this page (leave the function itself intact, it's used elsewhere).

The gallery becomes a discovery surface. Each book gets its own horizontal scrollable strip. Genre pills filter all strips simultaneously. The spoiler system is significantly simplified for this page — detailed below.

---

## Data Architecture Change

Currently `page.tsx` loads all image data server-side and passes it as props. We are changing this: `page.tsx` becomes a thin server component that only loads session context (viewer identity, library book IDs, user genre preferences, global spoiler setting, role). All image data is fetched client-side via a new API route.

---

## New API: `GET /api/gallery`

Create this new route. It replaces the server-side image loading that currently happens in `page.tsx`.

**Auth:** Works for both authenticated users and guests. For guests, treat as no library.

**Response shape:**

```typescript
{
  libraryRows: BookGalleryRow[]
  discoveryRows: BookGalleryRow[]
  userGenrePreferences: string[]   // BookGenre enum values
}

type BookGalleryRow = {
  bookId: string
  title: string
  author: string
  coverImageUrl: string | null
  genre: string                    // BookGenre enum value
  totalPublicImages: number        // ALL public images for this book — used for "X more inside" CTA
  images: GalleryImageCard[]
}

type GalleryImageCard = {
  id: string
  imageUrl: string
  chapterNumberAtTime: number
  userId: string
  username: string
  likeCount: number
  commentCount: number             // use viewerVisibleCommentCountByImageIds from lib/gallery-comment-counts.ts
  isLikedByCurrentUser: boolean
  isFeatured: boolean              // gold star badge
  isOwnImage: boolean              // for padlock badge logic
}
```

**Library rows logic:**

- Books where viewer has `UserBook` with `isActive: true`, joined with published non-deleted books
- Images: `isPublic: true`, ordered `createdAt desc`
- Apply existing spoiler gating: exclude images where `isGalleryImageChapterLocked` returns true, using the same chapter gate mode resolution from `lib/gallery-spoiler.ts` (`effectiveChapterGateMode` from `UserBook.spoilerProtection` + `User.globalSpoilerProtection`). Own images are never excluded (existing rule preserved).
- Admins: never chapter-locked, return all public images
- Row ordering: most recent `ReadingProgress.updatedAt` first, then `UserBook.createdAt`
- No cap on library rows — show all library books that have at least one visible image

**Discovery rows logic:**

- Published, non-deleted books NOT in viewer's library
- **Spoiler threshold per book:** `Math.ceil(totalChapters * 0.10)` where `totalChapters` is `COUNT` of `Chapter` rows for that book. Only include images where `isPublic: true` AND `chapterNumberAtTime <= threshold`.
- `totalChapters` must be computed server-side per book. Round up — a 5-chapter book has threshold `Math.ceil(0.5) = 1`.
- Images beyond the threshold are **not returned at all** — no lock state, simply absent.
- Exclude any book with zero qualifying images after threshold filter.
- `totalPublicImages`: the real total of ALL public images for that book (not just threshold-safe ones) — used for the invitation card.
- Order: books matching viewer's genre preferences first (any overlap between book genre and `user.genrePreferences`), then by qualifying image count desc.
- Cap at **5 discovery rows**.
- For guests: same logic, no library to exclude, order by qualifying image count desc.

**`commentCount`:** use `viewerVisibleCommentCountByImageIds` from `lib/gallery-comment-counts.ts` — same pattern as the existing `page.tsx`.

---

## `page.tsx` Changes

Slim down to a thin server component:

1. Resolve viewer identity via Clerk (may be null for guests)
2. If signed in: load `User` record (role, globalSpoilerProtection, genrePreferences), library book IDs
3. Pass to `GalleryClient`: `{ isLoggedIn, isAdmin, viewerUserId, globalSpoilerProtection, genrePreferences }`
4. Do not load any images server-side — all image data comes from the new API route via client fetch

---

## Client: `gallery-client.tsx` Full Rewrite

Replace the existing component. Preserve these patterns from the current implementation:

- `imagesById` map for optimistic like updates
- Like POST to `/api/gallery/[imageId]/like` with `sessionBrowsingUnlockedBookIds` when session reveal is active
- `GalleryImageModalShell` portal for modal — must remain portaled to `document.body`
- `GallerySpoilerSelect` dropdown in the header — keep it, it controls `gallerySessionRevealAll` state
- `gallerySessionRevealAll` state: when true, treat all library images as unlocked for display (client-only, same as current behaviour)
- Admin: never locked

**New layout structure:**

```
[Header: eyebrow + headline + subtitle + GallerySpoilerSelect]
[Guest banner — guests only]
[Genre pills]
[Section: FROM YOUR LIBRARY — library rows]
[Section: DISCOVER — discovery rows]
[Empty state — if both sections empty]
```

### Genre Pills

Horizontal scrollable row. Pills derived from the union of all genres across both `libraryRows` and `discoveryRows`, plus `userGenrePreferences` from the API response. "All" pill first (default selected). Selected pill uses `var(--accent)` fill. Filtering is purely client-side — hide/show rows based on `row.genre`. No re-fetch on pill change.

### Section Headers

Keep the existing section label style from `gallery-redesign.css` — eyebrow label style, extending gradient line, image count. FROM YOUR LIBRARY shows total visible image count across all library rows. DISCOVER shows row count (e.g. "5 books").

### BookRow Component

One row per book. Structure:

**Left anchor** (not scrollable, fixed width ~140px):
- Book cover portrait thumbnail (2:3, ~60px wide)
- Title (1 line, truncated)
- Author (muted, truncated)
- Genre pill/badge

**Scrollable strip** (drag-to-scroll, same pattern as `/discover` page carousel):
- Image cards left to right
- For discovery rows: "Add to library" invitation card always last
- Drag-to-scroll: implement the same `mousedown`/`mousemove`/`mouseup` mouse drag pattern used on the `/discover` page carousel

### Image Card (within BookRow)

Reuse the visual design of existing gallery cards as closely as possible:

- Image thumbnail
- Username
- Like count + comment count
- Corner badge: use existing `GalleryCardCornerBadge` component / `resolveLibraryPadlockBadge` logic for library rows; gold star for `isFeatured` images
- On click: open modal via `GalleryImageModalShell`

For library rows, apply `gallerySessionRevealAll` client-side recomputation for lock display — same as current implementation.

### "Add to Library" Invitation Card (discovery rows only, always last in strip)

Same dimensions as an image card. Design intent: feels like an invitation, not a hard wall.

- Background: book cover image, blurred and darkened overlay
- Centered: "**X more images inside**" where X = `totalPublicImages - images.length` (always ≥ 1 by our filtering rule)
- Below: "+ Add to library" button
- On click (logged in): `POST /api/library/{bookId}` with `{ spoilerProtection: "PROTECTED" }` then refresh gallery data
- On click (guest): redirect to `/login`
- Style: soft glow on the card, accent-coloured button, cover art visible through the overlay

### Guest Banner

Shown above genre pills for guests only. Soft, non-intrusive: "Sign in to see images from your own library and track your reading progress." Link to `/login`. Use existing alert/banner styling from `gallery-redesign.css`.

### Empty States

- Both sections empty: "The gallery is just getting started. Generate your first image from any book in your library." (centred, muted)
- FROM YOUR LIBRARY — no library books: "Add books to your library to see images here." with link to `/discover` — same `no_books` messaging as current
- FROM YOUR LIBRARY — has library books but no public images: keep existing `no_images` empty state

---

## Spoiler System on This Page

The new gallery intentionally simplifies spoiler handling for the main page:

- **Library rows:** same spoiler gating as today — server excludes locked images, `gallerySessionRevealAll` recomputes client-side, `GallerySpoilerSelect` controls it. Preserve all existing behaviour.
- **Discovery rows:** no spoiler state on the client. The API has already enforced the 10% threshold server-side. Cards are always shown as unlocked. No lock overlay, no `lockKind`, no padlock badge for discovery cards.
- **Session reveal:** only affects library rows, same as today.
- **`GallerySpoilerSelect` dropdown** remains in the header — it only meaningfully affects library rows, which is correct.

---

## Modal

Reuse `GalleryImageModalShell` exactly as today. The modal carousel (`memberModalCarouselIds`) should span all visible unlocked images across both library and discovery rows. Library row images that are client-locked are excluded from the carousel.

---

## CSS (`gallery-redesign.css`)

Extend, do not rewrite from scratch. Add styles for:

- `.book-row` — the horizontal row container
- `.book-row-anchor` — fixed left anchor
- `.book-row-strip` — the scrollable image strip
- `.gallery-genre-pills` — pill container
- `.gallery-genre-pill` / `.gallery-genre-pill.active` — individual pills
- `.invitation-card` — the "add to library" CTA card
- `.gallery-guest-banner` — guest sign-in prompt

Keep all existing class names and scoping under `.gallery-root`.

---

## Files to Create or Modify

| File | Action |
|------|--------|
| `app/api/gallery/route.ts` | **Create** — new unified data endpoint |
| `app/(public)/gallery/page.tsx` | **Modify** — slim down to session-only server component |
| `app/(public)/gallery/gallery-client.tsx` | **Rewrite** — new layout |
| `app/(public)/gallery/gallery-redesign.css` | **Extend** — add new classes only |

**Do not modify:**

- `lib/gallery-spoiler.ts`
- `lib/gallery-comment-counts.ts`
- `lib/gallery-card-spoiler-badge.ts`
- `lib/featured-image-selection.ts`
- `components/gallery/gallery-image-modal-shell.tsx`
- `components/gallery/modal-image-swipe-view.tsx`
- `components/gallery/gallery-spoiler-select.tsx`
- Anything under `app/(public)/gallery/[bookId]/`

---

## Key Constraints

- Spoiler threshold for discovery rows is computed server-side in the API — never on the client
- `totalPublicImages` is the real total across all public images for a book, not the threshold-filtered count
- Discovery rows with zero qualifying images are excluded entirely — no empty rows rendered
- Discovery capped at exactly 5 rows
- Genre filtering is client-side only — no re-fetch on pill change
- `GalleryImageModalShell` must remain portaled to `document.body` — do not move it into a stacking context
- `imagesById` optimistic like update pattern must be preserved
- `viewerVisibleCommentCountByImageIds` must be used for comment counts — not a raw DB count
