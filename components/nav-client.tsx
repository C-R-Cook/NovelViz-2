"use client";

import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserRole } from "@db";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavChromeProps = {
  initialUserId: string | null;
  role: UserRole | null;
  isLoggedIn: boolean;
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

export function NavChrome({ initialUserId, role, isLoggedIn }: NavChromeProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const showPartner = role === "partner" || role === "admin";
  const showAdmin = role === "admin";

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
      {isLoggedIn ? (
        <Link
          href="/library"
          className={navLinkClass(isActive(pathname, "/library"))}
          onClick={() => setMenuOpen(false)}
        >
          My Library
        </Link>
      ) : null}
      {showPartner ? (
        <Link
          href="/partner/dashboard"
          className={navLinkClass(isActive(pathname, "/partner"))}
          onClick={() => setMenuOpen(false)}
        >
          Partner Dashboard
        </Link>
      ) : null}
      {showAdmin ? (
        <Link
          href="/admin/books"
          className={navLinkClass(isActive(pathname, "/admin"))}
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      ) : null}
    </>
  );

  const tools = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
      <DevRoleSwitcher initialUserId={initialUserId} />
      <ThemeToggle />
    </div>
  );

  return (
    <header className="border-b border-zinc-800/90 bg-zinc-950/95 shadow-lg shadow-black/20 backdrop-blur-md dark:border-zinc-800/80">
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
