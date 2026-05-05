import Link from "next/link";

const linkClass =
  "text-sm text-text-muted transition hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-bg-surface/95 py-8 text-text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start"
          aria-label="Footer"
        >
          <Link href="/faq" className={linkClass}>
            FAQ
          </Link>
          <span className="text-border" aria-hidden>
            |
          </span>
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <span className="text-border" aria-hidden>
            |
          </span>
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          <span className="text-border" aria-hidden>
            |
          </span>
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>
        </nav>
        <p className="text-center text-xs text-text-muted sm:text-right">
          © 2026 NovelViz. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
