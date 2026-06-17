# Admin dashboard menu reference

Administrators see everything **readers** and **partners** see on the dashboard (Account, Library settings, My Images, Q&A History, Partner Program, Published books, Analytics, Image and Q&A), plus the **Admin Settings** section below.

Admin-only items also appear in the **top site nav** as a **Helpers** dropdown (`components/nav-client.tsx`). The dashboard sidebar uses the same helper links inside an expandable **Helpers** group.

Badge counts on queue items (For Review, Manage Featured Images, Spoiler Comments, Flagged comments) show how many items need attention.

---

## Admin Settings (dashboard tabs)

These open as tabs inside `/dashboard` (`lib/dashboard-tab.ts`).

| Title | Dashboard tab | Description |
|-------|---------------|-------------|
| **For Review** | `for-review` | Queue of books in `pending_review` status. Approve to publish or unlist, reject with a reason, open the full admin book editor, or soft-delete. Includes search across pending titles. |
| **Manage Featured Images** | `feature-approvals` | Curate images on the Discover community strip: view currently featured images, browse all generated images, approve/reject partner feature requests, and feature images by book. |
| **Spoiler Comments** | `spoiler-comments` | Comments auto-hidden as possible spoilers. Reinstate if safe, confirm spoiler gating, or delete. |
| **Flagged comments** | `flagged-comments` | Comments reported by readers as inappropriate. Restore or remove. |
| **All Books** | `all-books` | Searchable catalogue of every book, filterable by status (pending review, draft, published, unlisted, processing, rejected, deleted). Links into per-book admin detail. |
| **All Users** | `all-users` | Embedded user directory with search and sorting. Links to full user management at `/admin/users` for roles, credits, grants, badges, and usage. |
| **Admin Stats** | `admin-stats` | Platform KPIs (users, library adds, queries, images, likes), 30-day activity charts, estimated internal AI costs, and live vendor billing snapshots (OpenAI, fal.ai, Neon) when configured. Includes a summary of top book requests. |

---

## Admin-only dashboard link

| Title | Route | Description |
|-------|-------|-------------|
| **Book requests** | `/admin/requests` | Reader demand signals from Discover (including guest submissions). Aggregated counts by title plus individual submission history. |

---

## Helpers

Expandable group in the dashboard sidebar; same items appear under **Helpers** in the top navigation bar.

Defined in `lib/admin-helpers-nav.ts`. Each opens a standalone admin page under `/admin/*`.

| Title | Route | Description |
|-------|-------|-------------|
| **Cover refresh** | `/admin/cover-refresh` | Find pending-review books with generic Project Gutenberg covers, match Open Library artwork, and bulk-replace covers (uploaded to Cloudinary). |
| **Cover AI settings** | `/admin/cover-ai-settings` | Edit default prompt blocks and the allowed fal.ai models for the publisher cover generator. |
| **Subscription & credits** | `/admin/subscription-settings` | Configure per-tier monthly limits, credit costs, and credit pack pricing. Shows recent AI service failures. |
| **Featured scoring** | `/admin/featured-settings` | Tune weights for how featured books are ranked against reader genre preferences and partner audience targeting. Includes preview tooling. |
| **Bulk chapter delete** | `/admin/chapters/bulk-delete` | On pending-review books, search chapter titles by phrase (e.g. “Contents”), select books, and delete matching chapters in bulk (at least one chapter must remain per book). |
| **Gutenberg import** | `/admin/gutenberg-import` | Review the Project Gutenberg discovery queue before running ingest locally. Same destination as **Import queue** below. |
| **Data flows** | `/admin/data-flows` | Reference diagrams for ingest, image generation, Q&A, comments, and the optional Gutenberg bulk-import branch. |
| **T2I tester** | `/admin/t2i-tester` | Compare fal.ai text-to-image models side by side with preset prompts; outputs saved for local review. |

---

## Gutenberg pipeline (dashboard links)

Separate sidebar links below Helpers (`lib/gutenberg-admin-nav.ts`). These shortcut into the import workflow and publish list.

| Title | Route | Description |
|-------|-------|-------------|
| **Import queue** | `/admin/gutenberg-import` | Overview of the Gutenberg discovery queue and ingest approvals. |
| **Deferred** | `/admin/gutenberg-import?tab=deferred` | Titles with no EPUB or file too large — candidates for manual upload. |
| **Needs review** | `/admin/gutenberg-import?tab=review` | Borderline titles from automated discovery that need a human decision. |
| **Accepted** | `/admin/gutenberg-import?tab=accepted` | Titles approved and ready to queue for ingest. |
| **Publish** | `/admin/books` | Admin book list focused on moving `pending_review` books into the live Discover catalogue. |

Additional Gutenberg import tabs exist on the import page itself (**Rejected**, **Flagged**) but are not duplicated in the dashboard sidebar.

---

## Related admin pages (not in dashboard sidebar)

Reachable from All Users or direct URLs; admin-only via `app/admin/layout.tsx`.

| Title | Route | Description |
|-------|-------|-------------|
| **User detail** | `/admin/users/[userId]` | Single-user admin: role, subscription, Stripe customer, usage, credit grants, quota overrides, and badges. |
| **Book detail** | `/admin/books/[id]` | Full book administration: metadata, chapters, ingest, cover, targeting preview, status changes, and chapter bulk tools. |

---

## Source files

| Concern | File |
|---------|------|
| Dashboard sidebar structure | `lib/dashboard-tab.ts` |
| Helpers link list | `lib/admin-helpers-nav.ts` |
| Helpers UI (sidebar + top nav) | `components/admin/admin-helpers-nav.tsx` |
| Gutenberg sidebar links | `lib/gutenberg-admin-nav.ts` |
| Top nav admin gate | `components/nav-client.tsx` |
