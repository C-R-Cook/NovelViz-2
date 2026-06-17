import { ADMIN_STANDALONE_NAV_LINKS } from "@/lib/admin-helpers-nav";

/** Matches `UserRole` string values from Prisma — kept here so client components never import `@db` (avoids bundling Prisma in the browser). */
export type DashboardUserRole = "reader" | "partner" | "admin";

export type DashboardTabSlug =
  | "overview"
  | "reading"
  | "images"
  | "queries"
  | "partner-program"
  | "account"
  | "my-books"
  | "stats"
  | "feature-requests"
  | "for-review"
  | "feature-approvals"
  | "comment-moderation"
  | "all-books"
  | "all-users"
  | "admin-stats";

export type CommentModerationFilter = "all" | "spoiler" | "flagged";

export type DashboardNavBadge =
  | "forReview"
  | "featureApprovals"
  | "commentModeration"
  | "partnerFeatReq";

export type DashboardNavEntry =
  | { kind: "divider"; id: string }
  | { kind: "group-label"; id: string; label: string }
  | { kind: "tab"; tab: DashboardTabSlug; icon: string; badge?: DashboardNavBadge }
  | { kind: "link"; id: string; href: string; label: string; icon: string }
  | { kind: "dev-tools"; id: string; label: string; icon: string };

const READER_TABS: DashboardTabSlug[] = [
  "reading",
  "images",
  "queries",
  "partner-program",
  "account",
];

const PARTNER_EXTRA: DashboardTabSlug[] = ["my-books", "stats", "feature-requests"];

const ADMIN_EXTRA: DashboardTabSlug[] = [
  "for-review",
  "feature-approvals",
  "comment-moderation",
  "all-books",
  "all-users",
  "admin-stats",
];

function allowedTabsForRole(role: DashboardUserRole): Set<DashboardTabSlug> {
  if (role === "reader") return new Set(READER_TABS);
  if (role === "partner") return new Set([...READER_TABS.slice(0, 3), ...PARTNER_EXTRA, "account"]);
  return new Set([...READER_TABS.slice(0, 3), ...PARTNER_EXTRA, ...ADMIN_EXTRA, "account"]);
}

/** Flat list of selectable tabs for URL parsing (no dividers). */
export function dashboardTabsForRole(role: DashboardUserRole): DashboardTabSlug[] {
  return [...allowedTabsForRole(role)];
}

const READER_NAV: DashboardNavEntry[] = [
  { kind: "group-label", id: "gl-reader-settings", label: "Reader Settings" },
  { kind: "tab", tab: "reading", icon: "📚" },
  { kind: "tab", tab: "images", icon: "🖼️" },
  { kind: "tab", tab: "queries", icon: "💬" },
];

const PARTNER_NAV: DashboardNavEntry[] = [
  { kind: "group-label", id: "gl-partner-settings", label: "Partner Settings" },
  { kind: "tab", tab: "my-books", icon: "📖" },
  { kind: "tab", tab: "stats", icon: "📊" },
  { kind: "tab", tab: "feature-requests", icon: "✨", badge: "partnerFeatReq" },
];

const ADMIN_NAV: DashboardNavEntry[] = [
  { kind: "group-label", id: "gl-admin", label: "Admin" },
  { kind: "tab", tab: "for-review", icon: "✅", badge: "forReview" },
  { kind: "tab", tab: "feature-approvals", icon: "⭐", badge: "featureApprovals" },
  { kind: "tab", tab: "comment-moderation", icon: "💬", badge: "commentModeration" },
  { kind: "tab", tab: "all-books", icon: "📋" },
  { kind: "tab", tab: "all-users", icon: "👥" },
  { kind: "tab", tab: "admin-stats", icon: "📈" },
  ...ADMIN_STANDALONE_NAV_LINKS.map((link) => ({
    kind: "link" as const,
    id: link.id,
    href: link.href,
    label: link.label,
    icon: link.icon,
  })),
  {
    kind: "dev-tools",
    id: "admin-dev-tools",
    label: "Developer tools",
    icon: "⚙",
  },
];

/** Sidebar structure: account first, then role-scoped setting sections. */
export function dashboardNavForRole(role: DashboardUserRole): DashboardNavEntry[] {
  const accountBlock: DashboardNavEntry[] = [
    { kind: "tab", tab: "account", icon: "👤" },
    { kind: "divider", id: "d-after-account" },
  ];

  if (role === "reader") {
    return [...accountBlock, ...READER_NAV];
  }
  if (role === "partner") {
    return [...accountBlock, ...READER_NAV, ...PARTNER_NAV];
  }
  return [...accountBlock, ...READER_NAV, ...PARTNER_NAV, ...ADMIN_NAV];
}

export function defaultDashboardTab(role: DashboardUserRole): DashboardTabSlug {
  void role;
  return "reading";
}

const COMMENT_MODERATION_FILTER_SET = new Set<string>(["all", "spoiler", "flagged"]);

export function parseCommentModerationFilter(raw: string | null | undefined): CommentModerationFilter {
  if (raw && COMMENT_MODERATION_FILTER_SET.has(raw)) {
    return raw as CommentModerationFilter;
  }
  return "all";
}

function normalizeRawTab(role: DashboardUserRole, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw === "reader" || raw === "overview") return "reading";
  if (raw === "analytics") return "stats";
  if (raw === "spoiler-comments" || raw === "flagged-comments") return "comment-moderation";
  return raw;
}

export function parseDashboardTab(role: DashboardUserRole, raw: string | undefined): DashboardTabSlug {
  const allowed = allowedTabsForRole(role);
  const normalized = normalizeRawTab(role, raw);
  if (!normalized) return defaultDashboardTab(role);
  const candidate = normalized as DashboardTabSlug;
  if (allowed.has(candidate)) return candidate;
  return defaultDashboardTab(role);
}

export function dashboardTabLabel(tab: DashboardTabSlug): string {
  switch (tab) {
    case "overview":
      return "Overview";
    case "reading":
      return "Library settings";
    case "images":
      return "My Images";
    case "queries":
      return "Q&A History";
    case "partner-program":
      return "Partner Program";
    case "account":
      return "Account";
    case "my-books":
      return "Published books";
    case "stats":
      return "Analytics";
    case "feature-requests":
      return "Image and Q&A";
    case "for-review":
      return "For Review";
    case "feature-approvals":
      return "Manage Featured Images";
    case "comment-moderation":
      return "Comment Moderation";
    case "all-books":
      return "All Books";
    case "all-users":
      return "All Users";
    case "admin-stats":
      return "Admin Stats";
    default:
      return tab;
  }
}

/** Main heading per active section (matches reference PAGE_TITLES). */
export function dashboardPageTitle(tab: DashboardTabSlug): string {
  return dashboardTabLabel(tab);
}

export function dashboardTabHref(slug: DashboardTabSlug, role: DashboardUserRole): string {
  const def = defaultDashboardTab(role);
  if (slug === def) return "/dashboard";
  return `/dashboard?tab=${slug}`;
}

/** Sidebar highlight for dashboard tabs (includes related `/admin/*` routes). */
export function isDashboardTabNavActive(
  pathname: string,
  rawTab: string | null | undefined,
  role: DashboardUserRole,
  slug: DashboardTabSlug,
): boolean {
  if (slug === "all-users" && pathname.startsWith("/admin/users")) return true;
  if (slug === "all-books" && pathname.startsWith("/admin/books")) return true;
  if (pathname !== "/dashboard") return false;
  return parseDashboardTab(role, rawTab ?? undefined) === slug;
}
