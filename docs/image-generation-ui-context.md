# Image generation UI — codebase context

Reference for implementing shared loading visuals and fal → Cloudinary pipelines. **Do not** assume paths under `components/reader/`, `components/imagine/`, or `app/(reader)/(app)/reader/[bookId]/` for generation spinners — those do not host image-generation loading UI.

## Product surfaces

| Surface | Who | Loader integration | API |
|--------|-----|-------------------|-----|
| **Cover AI** | Partner (own books), Admin (all books, quota-exempt) | `components/cover-ai/cover-ai-modal.tsx` | `POST /api/books/[id]/cover-ai/generate` |
| **Library Imagine** | Readers (and admin model picker) | `app/(reader)/(app)/library/library-book-panel.tsx` | `POST /api/imagine` |
| **T2I tester** | Admin only, local files | `app/admin/t2i-tester/t2i-tester-client.tsx` | **Out of scope** — keep existing spinner |

## Cover AI — loading state (do not change logic)

- Component: [`components/cover-ai/cover-ai-modal.tsx`](../components/cover-ai/cover-ai-modal.tsx)
- On **Generate**, `runGenerate()` appends a carousel slide `{ kind: "loading", slotId }` and sets `generating` true.
- On success, that slide becomes `{ kind: "ready", imageUrl, publicId }`; on failure the loading slide is removed.
- Max **5** ready previews (`CAROUSEL_MAX`); loading slides do not count toward the cap.
- Loading UI is **inline** inside `aspect-[3/4] max-w-xs` portrait frame — **not** a full-screen overlay.
- Replace **only** the JSX for `currentSlide?.kind === "loading"` (spinner + text). Do not change quota, `runGenerate`, commit, or discard flows.
- Partner quota: `coverGenAttemptsConsumed` increments **after** successful Cloudinary upload (not on fal success alone). Admins are always quota-exempt server-side (`lib/cover-ai-access.ts`).

## Library Imagine — loading state (do not change logic)

- Component: [`app/(reader)/(app)/library/library-book-panel.tsx`](../app/(reader)/(app)/library/library-book-panel.tsx)
- `imgLoading` true during `submitImage()` → `POST /api/imagine`.
- Loader is a **bordered block** below the prompt (`py-8`), not inside an image frame.
- Replace **only** the `{imgLoading ? (...)}` block. Do not change limits, history modal, or Q&A tab.

## Shared loader component

- **Path:** `components/ui/image-generation-loader.tsx` + `components/ui/image-generation-loader.css`
- **Export:** `export function ImageGenerationLoader`
- **Props:** `className?: string`, `label?: string` (default `"Creating magic..."`), `ariaLabel?: string`
- **Layout:** Inline column, centered; fills parent flex area. Not a modal overlay.
- **A11y:** `role="status"`, `aria-live="polite"` on root (or preserve parent wrapper).
- **Motion:** Scope reduced-motion overrides under `.image-generation-loader`, not global `*`.
- **Sparks v1:** Decorative CSS sparks with `--angle` / `--distance`; true path-following sparks need `getPointAtLength` (future).

## Theme tokens

Defined per theme on `html[data-theme]` in [`app/globals.css`](../app/globals.css):

- Themes: `candle-light` (default dark), `aged-parchment` (light)
- Use: `--accent`, `--accent-glow`, `--highlight`, `--text-primary`, `--text-muted`, `--glow-color`

## fal → Cloudinary pipeline

| Flow | Prepare step | Cloudinary folder |
|------|----------------|-------------------|
| Cover AI | `fetchAndPrepareFalImageForCloudinary` in [`lib/prepare-fal-image-for-cloudinary.ts`](../lib/prepare-fal-image-for-cloudinary.ts) | `novelviz/cover-drafts/{bookId}` |
| Library Imagine | Same helper via [`lib/upload-prepared-image-to-cloudinary.ts`](../lib/upload-prepared-image-to-cloudinary.ts) | `novelviz/gallery` |

`prepareFalImageBufferForCloudinary`: sharp resize (max 2048), JPEG, stay under 10MB Cloudinary limit.

Cover prompt assembly: [`lib/cover-ai-prompt.ts`](../lib/cover-ai-prompt.ts) — empty `overlayTitle` / `overlayAuthor` skips title/author blocks.

## Integration checklist

1. Import `ImageGenerationLoader` in cover modal + library panel only.
2. Same `label` on both surfaces for visual parity.
3. Do not modify API request/response handling when swapping the loader.
4. Run `npm run build` before deploy.
