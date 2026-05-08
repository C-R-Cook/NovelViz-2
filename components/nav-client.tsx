"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavChromeProps = {
  initialUserId: string | null;
  isLoggedIn: boolean;
  userInitials: string;
  userName: string | null;
  userUsername: string | null;
  userEmail: string;
  userRole: "reader" | "partner" | "admin" | null;
  isProduction: boolean;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean): string {
  const base =
    "border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  if (active) {
    return `${base} border-accent text-text-primary`;
  }
  return `${base} text-text-muted hover:text-text-primary`;
}

function NavUserMenu({
  initials,
  menuPrimaryLabel,
  menuSecondaryLabel,
  userRole,
  isProduction,
  onNavigate,
}: {
  initials: string;
  menuPrimaryLabel: string;
  menuSecondaryLabel: string | null;
  userRole: "reader" | "partner" | "admin";
  isProduction: boolean;
  onNavigate: () => void;
}) {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const showDashboard = userRole === "partner" || userRole === "admin";
  const showAdmin = userRole === "admin";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-text-inverse shadow-md ring-2 ring-border transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {initials.slice(0, 2)}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-lg border border-border bg-bg-surface py-1 shadow-xl ring-1 ring-bg-overlay"
          role="menu"
        >
          <div className="border-b border-border-subtle px-3 py-2">
            <p className="truncate text-sm font-medium text-text-primary">{menuPrimaryLabel}</p>
            {menuSecondaryLabel ? (
              <p className="truncate text-xs text-text-muted">{menuSecondaryLabel}</p>
            ) : null}
          </div>
          <Link
            href="/account"
            className="block px-3 py-2 text-sm text-text-primary hover:bg-bg-raised"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            My Account
          </Link>
          {(showDashboard || showAdmin) && (
            <div className="my-1 border-t border-border-subtle" role="separator" />
          )}
          {showDashboard ? (
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-sm text-text-primary hover:bg-bg-raised"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
            >
              Dashboard
            </Link>
          ) : null}
          {showAdmin ? (
            <Link
              href="/admin/books"
              className="block px-3 py-2 text-sm text-text-primary hover:bg-bg-raised"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
            >
              Admin
            </Link>
          ) : null}
          <div className="my-1 border-t border-border-subtle" role="separator" />
          {isProduction ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-raised"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ redirectUrl: "/" });
              }}
            >
              Sign Out
            </button>
          ) : (
            <p className="px-3 py-2 text-xs leading-relaxed text-text-muted">
              Dev user: <span className="text-text-secondary">{menuPrimaryLabel}</span>
              <span className="mt-1 block text-[11px] text-text-muted">
                Use the role switcher to change identity. Production builds show Sign out here.
              </span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function NavChrome({
  initialUserId: _initialUserId,
  isLoggedIn,
  userInitials,
  userName,
  userUsername,
  userEmail,
  userRole,
  isProduction,
}: NavChromeProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const menuPrimaryLabel =
    userUsername?.trim() || userName?.trim() || userEmail || "Account";
  const menuSecondaryLabel =
    userUsername?.trim() || userName?.trim() ? userEmail : null;

  const links = (
    <>
      <Link
        href="/books"
        className={navLinkClass(isActive(pathname, "/books"))}
        onClick={() => setMenuOpen(false)}
      >
        Discover
      </Link>
      {isLoggedIn ? (
        <Link
          href="/library"
          className={navLinkClass(isActive(pathname, "/library"))}
          onClick={() => setMenuOpen(false)}
        >
          My Library
        </Link>
      ) : null}
      <Link
        href="/gallery"
        className={navLinkClass(isActive(pathname, "/gallery"))}
        onClick={() => setMenuOpen(false)}
      >
        Gallery
      </Link>
    </>
  );

  const signInClass =
    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-accent-text/95 transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-border bg-bg-base/95 shadow-lg shadow-bg-overlay backdrop-blur-md">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/"
            className={`shrink-0 font-serif text-lg font-semibold tracking-tight sm:text-xl ${
              isActive(pathname, "/")
                ? "text-accent-text"
                : "text-accent-text/90 hover:text-accent-hover"
            }`}
            onClick={() => setMenuOpen(false)}
          >
            NovelViz
          </Link>
          <nav
            className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-1 md:flex lg:justify-start lg:pl-4"
            aria-label="Main"
          >
            {links}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isLoggedIn && userRole ? (
            <NavUserMenu
              initials={userInitials}
              menuPrimaryLabel={menuPrimaryLabel}
              menuSecondaryLabel={menuSecondaryLabel}
              userRole={userRole}
              isProduction={isProduction}
              onNavigate={() => setMenuOpen(false)}
            />
          ) : (
            <Link href="/sign-in" className={signInClass} onClick={() => setMenuOpen(false)}>
              Sign In
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary shadow-inner transition hover:bg-bg-raised hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav-menu"
          className="absolute left-0 right-0 top-full max-h-[min(70vh,calc(100dvh-3.75rem))] overflow-y-auto border-t border-border bg-bg-base/98 px-4 py-4 shadow-lg backdrop-blur-md md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Main mobile">
            {links}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
