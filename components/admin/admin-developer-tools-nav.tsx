"use client";

import {
  ADMIN_DEVELOPER_TOOLS_LINKS,
  isAdminNavLinkActive,
  isAnyDeveloperToolsPathActive,
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

type AdminDeveloperToolsNavProps = {
  onNavigate?: () => void;
};

export function AdminDeveloperToolsNav({ onNavigate }: AdminDeveloperToolsNavProps) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const groupActive = isAnyDeveloperToolsPathActive(pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        <span className="dashboard-nav-label flex-1 text-left">Developer tools</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="dashboard-helpers-children">
          {ADMIN_DEVELOPER_TOOLS_LINKS.map((link) => {
            const active = isAdminNavLinkActive(pathname, link.href);
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
