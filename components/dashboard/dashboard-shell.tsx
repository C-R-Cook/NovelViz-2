"use client";

import { AdminDeveloperToolsNav } from "@/components/admin/admin-developer-tools-nav";
import { isAdminNavLinkActive } from "@/lib/admin-helpers-nav";
import type { DashboardNavBadgeCounts } from "@/lib/dashboard-data";
import {
  dashboardNavForRole,
  dashboardTabHref,
  dashboardTabLabel,
  isDashboardTabNavActive,
  type DashboardNavBadge,
  type DashboardNavEntry,
  type DashboardTabSlug,
  type DashboardUserRole,
} from "@/lib/dashboard-tab";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import "@/app/(reader)/(app)/dashboard/dashboard-redesign.css";

const DASHBOARD_SIDEBAR_COLLAPSED_KEY = "dashboard_sidebar_collapsed";

function readSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DASHBOARD_SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(DASHBOARD_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function navBadgeValue(
  badge: DashboardNavBadge | undefined,
  counts: DashboardNavBadgeCounts,
): number {
  if (!badge) return 0;
  if (badge === "forReview") return counts.forReview;
  if (badge === "featureApprovals") return counts.featureApprovals;
  if (badge === "commentModeration") return counts.commentModeration;
  if (badge === "partnerFeatReq") return counts.partnerFeatReq;
  return 0;
}

function SidebarCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" aria-hidden>
      {collapsed ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      )}
    </svg>
  );
}

function SidebarToggleIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export type DashboardShellProps = {
  role: DashboardUserRole;
  roleDisplayLabel: string;
  displayName: string;
  badgeCounts: DashboardNavBadgeCounts;
  children: React.ReactNode;
  /** When omitted, section heading is hidden (standalone admin pages supply their own titles). */
  sectionTitle?: string;
  sectionEyebrow?: string;
  /** Partner program tab uses toggle-only header on small screens. */
  sectionHeadVariant?: "default" | "toggle-only";
};

export function DashboardShell({
  role,
  roleDisplayLabel,
  displayName,
  badgeCounts,
  children,
  sectionTitle,
  sectionEyebrow,
  sectionHeadVariant = "default",
}: DashboardShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const navEntries = useMemo(() => dashboardNavForRole(role), [role]);
  const rawTab = searchParams.get("tab");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    setSidebarCollapsed(readSidebarCollapsedPreference());
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
    closeSidebar();
  }, [pathname, rawTab, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) closeSidebar();
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  function renderNavRow(entry: DashboardNavEntry) {
    if (entry.kind === "divider") {
      return <div key={entry.id} className="dashboard-nav-divider" />;
    }
    if (entry.kind === "group-label") {
      return <div key={entry.id} className="dashboard-nav-group-label">{entry.label}</div>;
    }
    if (entry.kind === "dev-tools") {
      return <AdminDeveloperToolsNav key={entry.id} onNavigate={closeSidebar} />;
    }
    if (entry.kind === "link") {
      const active = isAdminNavLinkActive(pathname, entry.href);
      return (
        <Link
          key={entry.id}
          href={entry.href}
          className="dashboard-nav-btn no-underline"
          data-active={active ? "true" : "false"}
          onClick={closeSidebar}
        >
          <span className="dashboard-nav-icon" aria-hidden>
            {entry.icon}
          </span>
          <span className="dashboard-nav-label">{entry.label}</span>
        </Link>
      );
    }
    const { tab: slug, icon, badge } = entry;
    const n = navBadgeValue(badge, badgeCounts);
    const active = isDashboardTabNavActive(pathname, rawTab, role, slug);
    return (
      <Link
        key={slug}
        href={dashboardTabHref(slug, role)}
        className="dashboard-nav-btn no-underline"
        data-active={active ? "true" : "false"}
        onClick={closeSidebar}
      >
        <span className="dashboard-nav-icon" aria-hidden>
          {icon}
        </span>
        <span className="dashboard-nav-label">{dashboardTabLabel(slug)}</span>
        {badge && n > 0 ? <span className="dashboard-nav-badge">{n > 99 ? "99+" : n}</span> : null}
      </Link>
    );
  }

  const showSectionHead = sectionTitle !== undefined || sectionHeadVariant === "toggle-only";

  return (
    <div className="dashboard-root">
      <div className="dashboard-root-inner">
        <div className="dashboard-body">
          {sidebarOpen ? (
            <button
              type="button"
              className="dashboard-sidebar-backdrop"
              aria-label="Close menu"
              onClick={closeSidebar}
            />
          ) : null}
          <div
            className="dashboard-sidebar-shell"
            data-collapsed={sidebarCollapsed ? "true" : "false"}
          >
            <aside
              id="dashboard-sidebar"
              className="dashboard-sidebar"
              data-open={sidebarOpen ? "true" : "false"}
            >
              <div className="dashboard-sidebar-user">
                <div className="dashboard-sidebar-role">{roleDisplayLabel}</div>
                <div className="dashboard-sidebar-name">{displayName}</div>
              </div>
              <div className="dashboard-sidebar-cta-wrap">
                {role === "reader" ? (
                  <Link
                    href={dashboardTabHref("partner-program", role)}
                    className="dashboard-sidebar-cta no-underline"
                    onClick={closeSidebar}
                  >
                    ✦ Become a partner
                  </Link>
                ) : (
                  <Link
                    href="/partner/books/new"
                    className="dashboard-sidebar-cta no-underline"
                    onClick={closeSidebar}
                  >
                    ＋ Upload New Book
                  </Link>
                )}
              </div>
              {navEntries.map(renderNavRow)}
            </aside>
            <button
              type="button"
              className="dashboard-sidebar-collapse-btn"
              aria-expanded={!sidebarCollapsed}
              aria-controls="dashboard-sidebar"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleSidebarCollapsed}
            >
              <SidebarCollapseIcon collapsed={sidebarCollapsed} />
            </button>
          </div>

          <main className="dashboard-main">
            {showSectionHead ? (
              <div
                className={
                  sectionHeadVariant === "toggle-only"
                    ? "dashboard-section-head dashboard-section-head--partner-program"
                    : "dashboard-section-head dashboard-section-head--animate"
                }
              >
                <div className="dashboard-section-head-row">
                  {sectionTitle !== undefined && sectionHeadVariant !== "toggle-only" ? (
                    <div className="dashboard-section-head-text">
                      {sectionEyebrow ? (
                        <div className="dashboard-section-eyebrow">{sectionEyebrow}</div>
                      ) : null}
                      <h1 className="dashboard-section-title">{sectionTitle}</h1>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="dashboard-sidebar-toggle"
                    aria-expanded={sidebarOpen}
                    aria-controls="dashboard-sidebar"
                    onClick={() => setSidebarOpen((o) => !o)}
                  >
                    <SidebarToggleIcon open={sidebarOpen} />
                    <span className="dashboard-sidebar-toggle-label">
                      {sidebarOpen ? "Close" : "Menu"}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="dashboard-section-head dashboard-section-head--partner-program lg:hidden">
                <div className="dashboard-section-head-row">
                  <button
                    type="button"
                    className="dashboard-sidebar-toggle"
                    aria-expanded={sidebarOpen}
                    aria-controls="dashboard-sidebar"
                    onClick={() => setSidebarOpen((o) => !o)}
                  >
                    <SidebarToggleIcon open={sidebarOpen} />
                    <span className="dashboard-sidebar-toggle-label">
                      {sidebarOpen ? "Close" : "Menu"}
                    </span>
                  </button>
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
