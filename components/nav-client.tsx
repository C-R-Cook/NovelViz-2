"use client";

import { useClerk } from "@clerk/nextjs";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavChromeProps = {
  initialUserId: string | null;
  isLoggedIn: boolean;
  userInitials: string;
  userName: string | null;
  userEmail: string;
  isProduction: boolean;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean): string {
  const base =
    "border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40";
  if (active) {
    return `${base} border-amber-500 text-zinc-100 dark:border-amber-400 dark:text-zinc-100`;
  }
  return `${base} text-zinc-400 hover:text-zinc-100`;
}

function NavUserMenu({
  initials,
  displayName,
  email,
  isProduction,
  onNavigate,
}: {
  initials: string;
  displayName: string | null;
  email: string;
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

  const headerLabel = displayName?.trim() || email;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 shadow-md ring-2 ring-zinc-800/80 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:bg-amber-500 dark:text-zinc-950 dark:ring-zinc-700/80 dark:hover:bg-amber-400"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {initials.slice(0, 2)}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-lg border border-zinc-700/90 bg-zinc-900 py-1 shadow-xl ring-1 ring-black/20 dark:bg-zinc-950"
          role="menu"
        >
          <div className="border-b border-zinc-800 px-3 py-2">
            <p className="truncate text-sm font-medium text-zinc-100">{headerLabel}</p>
            {displayName?.trim() ? (
              <p className="truncate text-xs text-zinc-500">{email}</p>
            ) : null}
          </div>
          <Link
            href="/account"
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/80"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            My Account
          </Link>
          <Link
            href="/dashboard"
            className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/80"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            Dashboard
          </Link>
          <div className="my-1 border-t border-zinc-800" role="separator" />
          {isProduction ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/80"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ redirectUrl: "/" });
              }}
            >
              Sign Out
            </button>
          ) : (
            <p className="px-3 py-2 text-xs leading-relaxed text-zinc-500">
              Dev user: <span className="text-zinc-400">{headerLabel}</span>
              <span className="mt-1 block text-[11px] text-zinc-600">
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
  initialUserId,
  isLoggedIn,
  userInitials,
  userName,
  userEmail,
  isProduction,
}: NavChromeProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const links = (
    <>
      <Link
        href="/discover"
        className={navLinkClass(isActive(pathname, "/discover"))}
        onClick={() => setMenuOpen(false)}
      >
        Discover
      </Link>
      <Link
        href="/gallery"
        className={navLinkClass(isActive(pathname, "/gallery"))}
        onClick={() => setMenuOpen(false)}
      >
        Gallery
      </Link>
    </>
  );

  const tools = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
      <DevRoleSwitcher initialUserId={initialUserId} />
      <ThemeToggle />
    </div>
  );

  const signInClass =
    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-amber-200/95 transition hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40";

  return (
    <header className="relative z-[100] border-b border-zinc-800/90 bg-zinc-950/95 shadow-lg shadow-black/20 backdrop-blur-md dark:border-zinc-800/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/"
            className={`shrink-0 font-serif text-lg font-semibold tracking-tight sm:text-xl ${
              isActive(pathname, "/")
                ? "text-amber-200"
                : "text-amber-100/90 hover:text-amber-50"
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
          {isLoggedIn ? (
            <NavUserMenu
              initials={userInitials}
              displayName={userName}
              email={userEmail}
              isProduction={isProduction}
              onNavigate={() => setMenuOpen(false)}
            />
          ) : (
            <Link href="/login" className={signInClass} onClick={() => setMenuOpen(false)}>
              Sign In
            </Link>
          )}
          <div className="hidden items-center gap-2 md:flex">{tools}</div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/80 text-zinc-200 shadow-inner transition hover:bg-zinc-800 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 md:hidden"
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
          className="border-t border-zinc-800/90 bg-zinc-950/98 px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Main mobile">
            {links}
          </nav>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
            {tools}
          </div>
        </div>
      ) : null}
    </header>
  );
}
