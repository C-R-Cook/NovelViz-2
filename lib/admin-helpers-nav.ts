import { isGutenbergAdminSectionActive } from "@/lib/gutenberg-admin-nav";

export type AdminHelperNavLink = {
  id: string;
  href: string;
  label: string;
  icon: string;
  hint?: string;
};

/** Admin utility pages grouped under “Helpers” in nav and dashboard sidebar. */
export const ADMIN_HELPERS_NAV_LINKS: readonly AdminHelperNavLink[] = [
  {
    id: "helper-covers",
    href: "/admin/cover-refresh",
    label: "Cover refresh",
    icon: "🖼",
    hint: "Replace PG generic covers with Open Library",
  },
  {
    id: "helper-cover-ai-settings",
    href: "/admin/cover-ai-settings",
    label: "Cover AI settings",
    icon: "✦",
    hint: "Edit default prompts + allowed fal models",
  },
  {
    id: "helper-bulk-chapters",
    href: "/admin/chapters/bulk-delete",
    label: "Bulk chapter delete",
    icon: "✂",
    hint: "Remove matching chapters from pending review books",
  },
  {
    id: "helper-gutenberg",
    href: "/admin/gutenberg-import",
    label: "Gutenberg import",
    icon: "📚",
    hint: "Discovery queue & ingest approvals",
  },
  {
    id: "helper-data-flows",
    href: "/admin/data-flows",
    label: "Data flows",
    icon: "◇",
    hint: "Pipeline diagrams for ingest & AI",
  },
  {
    id: "helper-t2i",
    href: "/admin/t2i-tester",
    label: "T2I tester",
    icon: "◻",
    hint: "fal.ai model comparison (local output)",
  },
] as const;

export function isAdminHelperPathActive(pathname: string, href: string): boolean {
  if (href === "/admin/gutenberg-import") {
    return isGutenbergAdminSectionActive(pathname);
  }
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAnyAdminHelperPathActive(pathname: string): boolean {
  return ADMIN_HELPERS_NAV_LINKS.some((link) => isAdminHelperPathActive(pathname, link.href));
}
