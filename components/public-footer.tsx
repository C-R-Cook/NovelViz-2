import Link from "next/link";

const linkClass =
  "text-sm text-text-muted transition hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

const FOOTER_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/acceptable-use", label: "Acceptable Use" },
] as const;

export function PublicFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-bg-surface/95 py-8 text-text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-6">
        <p className="text-xs text-text-muted">© 2026 NovelViz. All rights reserved.</p>
        <nav
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map((link, index) => (
            <span key={link.href} className="contents">
              {index > 0 ? (
                <span className="text-border" aria-hidden>
                  |
                </span>
              ) : null}
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
