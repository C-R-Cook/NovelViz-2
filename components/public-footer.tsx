import Link from "next/link";

const linkClass =
  "text-sm text-zinc-600 transition hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-zinc-400 dark:hover:text-amber-300/90";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200/90 bg-zinc-100/90 py-8 text-zinc-600 dark:border-zinc-800/90 dark:bg-zinc-950 dark:text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start"
          aria-label="Footer"
        >
          <Link href="/faq" className={linkClass}>
            FAQ
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            |
          </span>
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            |
          </span>
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            |
          </span>
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>
        </nav>
        <p className="text-center text-xs text-zinc-500 sm:text-right dark:text-zinc-600">
          © 2026 NovelViz. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
