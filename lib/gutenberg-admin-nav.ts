/** Admin navigation for the Gutenberg import pipeline (queue → ingest → publish). */

export type GutenbergImportTab =
  | "overview"
  | "accepted"
  | "review"
  | "rejected"
  | "deferred"
  | "manual";

const GUTENBERG_IMPORT_TAB_SET = new Set<string>([
  "overview",
  "accepted",
  "review",
  "rejected",
  "deferred",
  "manual",
]);

export type GutenbergImportTabDef = {
  tab: GutenbergImportTab;
  label: string;
  icon: string;
  hint?: string;
};

/** Tabs on `/admin/gutenberg-import` (separate panels, not in-page anchors). */
export const GUTENBERG_IMPORT_TABS: readonly GutenbergImportTabDef[] = [
  { tab: "overview", label: "Overview", icon: "📚", hint: "Queue summary" },
  { tab: "accepted", label: "Accepted", icon: "✓", hint: "Ready to queue for ingest" },
  { tab: "review", label: "Needs review", icon: "?", hint: "Borderline titles from fetch" },
  { tab: "rejected", label: "Rejected", icon: "✕", hint: "Filtered out by discovery" },
  { tab: "deferred", label: "Deferred", icon: "⊘", hint: "No EPUB / too large — manual upload" },
  { tab: "manual", label: "Flagged", icon: "!", hint: "Still on queue — not parked yet" },
] as const;

export function gutenbergImportHref(tab: GutenbergImportTab): string {
  if (tab === "overview") return "/admin/gutenberg-import";
  return `/admin/gutenberg-import?tab=${tab}`;
}

export type GutenbergAdminNavLink = {
  id: string;
  href: string;
  label: string;
  icon: string;
  hint?: string;
};

/** Dashboard sidebar + top-level admin links (import tabs use `?tab=`). */
export const GUTENBERG_ADMIN_NAV_LINKS: readonly GutenbergAdminNavLink[] = [
  {
    id: "gutenberg-overview",
    href: gutenbergImportHref("overview"),
    label: "Import queue",
    icon: "📚",
    hint: "Discovery queue & approvals",
  },
  {
    id: "gutenberg-deferred",
    href: gutenbergImportHref("deferred"),
    label: "Deferred",
    icon: "⊘",
    hint: "No EPUB / too large — manual upload",
  },
  {
    id: "gutenberg-review",
    href: gutenbergImportHref("review"),
    label: "Needs review",
    icon: "?",
    hint: "Borderline titles from fetch",
  },
  {
    id: "gutenberg-accepted",
    href: gutenbergImportHref("accepted"),
    label: "Accepted",
    icon: "✓",
    hint: "Ready to queue for ingest",
  },
  {
    id: "gutenberg-publish",
    href: "/admin/books",
    label: "Publish",
    icon: "◎",
    hint: "Pending review → Discover",
  },
] as const;

export function parseGutenbergTab(raw: string | null | undefined): GutenbergImportTab {
  if (raw && GUTENBERG_IMPORT_TAB_SET.has(raw)) {
    return raw as GutenbergImportTab;
  }
  return "overview";
}

/** `/admin/books` list only — not `/admin/books/[id]` (partner/for-review book review). */
export function isAdminBooksListPath(pathname: string): boolean {
  return pathname === "/admin/books";
}

/** Top-level “Gutenberg” nav: import pipeline + publish list, not individual book review. */
export function isGutenbergAdminSectionActive(pathname: string): boolean {
  return pathname.startsWith("/admin/gutenberg-import") || isAdminBooksListPath(pathname);
}

export function gutenbergNavLinkIsActive(
  pathname: string,
  tabParam: string | null | undefined,
  href: string,
): boolean {
  if (href === "/admin/books" || href.startsWith("/admin/books?")) {
    return isAdminBooksListPath(pathname);
  }
  if (!pathname.startsWith("/admin/gutenberg-import")) return false;
  try {
    const linkTab = parseGutenbergTab(new URL(href, "http://local").searchParams.get("tab"));
    const currentTab = parseGutenbergTab(tabParam);
    return linkTab === currentTab;
  } catch {
    return false;
  }
}
