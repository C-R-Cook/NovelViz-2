/** Matches `UserRole` string values from Prisma — kept here so client components never import `@db` (avoids bundling Prisma in the browser). */
export type DashboardUserRole = "reader" | "partner" | "admin";

export type DashboardTabSlug =
  | "reader"
  | "my-books"
  | "stats"
  | "for-review"
  | "feature-requests"
  | "all-books"
  | "admin-stats";

const ALL_TAB_ORDER: DashboardTabSlug[] = [
  "reader",
  "my-books",
  "stats",
  "for-review",
  "feature-requests",
  "all-books",
  "admin-stats",
];

export function dashboardTabsForRole(role: DashboardUserRole): DashboardTabSlug[] {
  if (role === "reader") {
    return ["reader"];
  }
  if (role === "partner") {
    return ["reader", "my-books", "stats"];
  }
  return ALL_TAB_ORDER;
}

/** First tab the user may see — used when `tab` missing or forbidden. */
export function defaultDashboardTab(role: DashboardUserRole): DashboardTabSlug {
  const v = dashboardTabsForRole(role);
  return v[0] ?? "reader";
}

export function parseDashboardTab(role: DashboardUserRole, raw: string | undefined): DashboardTabSlug {
  const allowed = new Set(dashboardTabsForRole(role));
  const all = ALL_TAB_ORDER.includes(raw as DashboardTabSlug) ? (raw as DashboardTabSlug) : null;
  if (all && allowed.has(all)) return all;
  return defaultDashboardTab(role);
}

export function dashboardTabLabel(tab: DashboardTabSlug): string {
  switch (tab) {
    case "reader":
      return "Reader";
    case "my-books":
      return "My Publishes";
    case "stats":
      return "Stats";
    case "for-review":
      return "For Review";
    case "feature-requests":
      return "Feature Requests";
    case "all-books":
      return "All Books";
    case "admin-stats":
      return "Admin Stats";
    default:
      return tab;
  }
}
