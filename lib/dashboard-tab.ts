import { GUTENBERG_ADMIN_NAV_LINKS } from "@/lib/gutenberg-admin-nav";

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
  | "spoiler-comments"
  | "flagged-comments"
  | "all-books"
  | "all-users"
  | "admin-stats";

export type DashboardNavBadge =
  | "forReview"
  | "featureApprovals"
  | "spoilerComments"
  | "flaggedComments"
  | "partnerFeatReq";

export type DashboardNavEntry =
  | { kind: "divider"; id: string }
  | { kind: "tab"; tab: DashboardTabSlug; icon: string; badge?: DashboardNavBadge }
  | { kind: "link"; id: string; href: string; label: string; icon: string };

const READER_TABS: DashboardTabSlug[] = [
  "overview",
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
  "spoiler-comments",
  "flagged-comments",
  "all-books",
  "all-users",
  "admin-stats",
];

function allowedTabsForRole(role: DashboardUserRole): Set<DashboardTabSlug> {
  if (role === "reader") return new Set(READER_TABS);
  if (role === "partner") return new Set([...READER_TABS.slice(0, 4), ...PARTNER_EXTRA, "account"]);
  return new Set([...READER_TABS.slice(0, 4), ...PARTNER_EXTRA, ...ADMIN_EXTRA, "account"]);
}

/** Flat list of selectable tabs for URL parsing (no dividers). */
export function dashboardTabsForRole(role: DashboardUserRole): DashboardTabSlug[] {
  return [...allowedTabsForRole(role)];
}

/** Sidebar structure: tabs, hairline dividers, optional badges (resolved in UI from counts). */
export function dashboardNavForRole(role: DashboardUserRole): DashboardNavEntry[] {
  const base: DashboardNavEntry[] = [
    { kind: "tab", tab: "overview", icon: "◈" },
    { kind: "tab", tab: "reading", icon: "📖" },
    { kind: "tab", tab: "images", icon: "◻" },
    { kind: "tab", tab: "queries", icon: "?" },
  ];
  if (role === "reader") {
    return [
      ...base,
      { kind: "tab", tab: "partner-program", icon: "◇" },
      { kind: "tab", tab: "account", icon: "○" },
    ];
  }
  const partnerBlock: DashboardNavEntry[] = [
    { kind: "divider", id: "d1" },
    { kind: "tab", tab: "my-books", icon: "▤" },
    { kind: "tab", tab: "stats", icon: "↗" },
    { kind: "tab", tab: "feature-requests", icon: "★", badge: "partnerFeatReq" },
  ];
  if (role === "partner") {
    return [...base, ...partnerBlock, { kind: "divider", id: "d2" }, { kind: "tab", tab: "account", icon: "○" }];
  }
  const adminBlock: DashboardNavEntry[] = [
    { kind: "divider", id: "d2" },
    { kind: "tab", tab: "for-review", icon: "✓", badge: "forReview" },
    { kind: "tab", tab: "feature-approvals", icon: "☆", badge: "featureApprovals" },
    { kind: "tab", tab: "spoiler-comments", icon: "⚠", badge: "spoilerComments" },
    { kind: "tab", tab: "flagged-comments", icon: "!", badge: "flaggedComments" },
    { kind: "tab", tab: "all-books", icon: "▤" },
    { kind: "tab", tab: "all-users", icon: "◎" },
    { kind: "tab", tab: "admin-stats", icon: "∑" },
    { kind: "divider", id: "d-gutenberg" },
    ...GUTENBERG_ADMIN_NAV_LINKS.map((link) => ({
      kind: "link" as const,
      id: link.id,
      href: link.href,
      label: link.label,
      icon: link.icon,
    })),
    { kind: "divider", id: "d3" },
    { kind: "tab", tab: "account", icon: "○" },
  ];
  return [...base, ...partnerBlock, ...adminBlock];
}

export function defaultDashboardTab(role: DashboardUserRole): DashboardTabSlug {
  void role;
  return "overview";
}

function normalizeRawTab(role: DashboardUserRole, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw === "reader") return "overview";
  if (raw === "feature-requests" && role === "admin") return "feature-approvals";
  if (raw === "analytics") return "stats";
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
      return "Currently Reading";
    case "images":
      return "My Images";
    case "queries":
      return "Q&A History";
    case "partner-program":
      return "Become a Partner";
    case "account":
      return "Account";
    case "my-books":
      return "My Books";
    case "stats":
      return "Analytics";
    case "feature-requests":
      return "Feature Requests";
    case "for-review":
      return "For Review";
    case "feature-approvals":
      return "Feature Approvals";
    case "spoiler-comments":
      return "Spoiler Comments";
    case "flagged-comments":
      return "Flagged comments";
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
