"use client";

import {
  ADMIN_HELPERS_NAV_LINKS,
  isAdminHelperPathActive,
  isAnyAdminHelperPathActive,
} from "@/lib/admin-helpers-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

type TopNavProps = {
  variant: "top";
  navLinkClass: (active: boolean) => string;
  onNavigate?: () => void;
};

type SidebarProps = {
  variant: "sidebar";
  onNavigate?: () => void;
};

export function AdminHelpersNav(props: TopNavProps | SidebarProps) {
  const { variant, onNavigate } = props;
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const groupActive = isAnyAdminHelperPathActive(pathname);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (variant === "top") {
    const triggerClass = props.navLinkClass(groupActive);
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className={`${triggerClass} inline-flex items-center gap-1`}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
        >
          Helpers
          <Chevron open={open} />
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-[110] mt-1 min-w-[12rem] rounded-lg border border-border bg-bg-surface py-1 shadow-lg"
          >
            {ADMIN_HELPERS_NAV_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                role="menuitem"
                title={link.hint}
                className={`block px-3 py-2 text-sm transition hover:bg-bg-raised ${
                  isAdminHelperPathActive(pathname, link.href)
                    ? "font-medium text-text-primary"
                    : "text-text-secondary"
                }`}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <span className="mr-2" aria-hidden>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="dashboard-helpers-group">
      <button
        type="button"
        className="dashboard-nav-btn w-full"
        data-active={groupActive ? "true" : "false"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dashboard-nav-icon" aria-hidden>
          ⚙
        </span>
        <span className="dashboard-nav-label flex-1 text-left">Helpers</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="dashboard-helpers-children">
          {ADMIN_HELPERS_NAV_LINKS.map((link) => {
            const active = isAdminHelperPathActive(pathname, link.href);
            return (
              <Link
                key={link.id}
                href={link.href}
                title={link.hint}
                className="dashboard-nav-btn dashboard-helpers-child no-underline"
                data-active={active ? "true" : "false"}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <span className="dashboard-nav-icon" aria-hidden>
                  {link.icon}
                </span>
                <span className="dashboard-nav-label">{link.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
