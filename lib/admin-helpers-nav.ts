export type AdminNavLink = {
  id: string;
  href: string;
  label: string;
  icon: string;
  hint?: string;
};

/** Standalone admin pages in the flat Admin sidebar section. */
export const ADMIN_STANDALONE_NAV_LINKS: readonly AdminNavLink[] = [
  {
    id: "admin-book-requests",
    href: "/admin/requests",
    label: "Book requests",
    icon: "📖",
  },
  {
    id: "admin-cover-refresh",
    href: "/admin/cover-refresh",
    label: "Cover refresh",
    icon: "🖼",
    hint: "Replace PG generic covers with Open Library",
  },
  {
    id: "admin-cover-ai-settings",
    href: "/admin/cover-ai-settings",
    label: "Cover AI settings",
    icon: "✦",
    hint: "Edit default prompts + allowed fal models",
  },
  {
    id: "admin-subscription-settings",
    href: "/admin/subscription-settings",
    label: "Subscription & credits",
    icon: "💳",
    hint: "Tier limits, credit packs, and pricing",
  },
  {
    id: "admin-featured-scoring",
    href: "/admin/featured-settings",
    label: "Featured scoring",
    icon: "◎",
    hint: "Tune featured book ranking weights and preview matches",
  },
  {
    id: "admin-import-queue",
    href: "/admin/gutenberg-import",
    label: "Import queue",
    icon: "📚",
    hint: "Discovery queue & ingest approvals",
  },
] as const;

/** Nested under Developer tools (collapsed by default). */
export const ADMIN_DEVELOPER_TOOLS_LINKS: readonly AdminNavLink[] = [
  {
    id: "admin-data-flows",
    href: "/admin/data-flows",
    label: "Data flows",
    icon: "◇",
    hint: "Pipeline diagrams for ingest & AI",
  },
  {
    id: "admin-t2i-tester",
    href: "/admin/t2i-tester",
    label: "T2I tester",
    icon: "◻",
    hint: "fal.ai model comparison (local output)",
  },
] as const;

export function isGutenbergImportPathActive(pathname: string): boolean {
  return pathname.startsWith("/admin/gutenberg-import");
}

export function isAdminNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/admin/gutenberg-import") {
    return isGutenbergImportPathActive(pathname);
  }
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAnyDeveloperToolsPathActive(pathname: string): boolean {
  return ADMIN_DEVELOPER_TOOLS_LINKS.some((link) => isAdminNavLinkActive(pathname, link.href));
}
