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
