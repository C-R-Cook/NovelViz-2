"use client";

import {
  GUTENBERG_IMPORT_TABS,
  gutenbergImportHref,
  parseGutenbergTab,
  type GutenbergImportTab,
} from "@/lib/gutenberg-admin-nav";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type GutenbergTabCounts = Partial<Record<GutenbergImportTab, number>>;

type GutenbergSectionNavProps = {
  counts?: GutenbergTabCounts;
  /** Shown after import tabs (e.g. Publish → books admin). */
  externalLinks?: Array<{ href: string; label: string; icon: string; hint?: string }>;
};

export function GutenbergSectionNav({ counts, externalLinks }: GutenbergSectionNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = parseGutenbergTab(searchParams.get("tab"));

  if (!pathname?.startsWith("/admin/gutenberg-import")) {
    return null;
  }

  function selectTab(tab: GutenbergImportTab) {
    const href = gutenbergImportHref(tab);
    router.replace(href, { scroll: false });
  }

  return (
    <nav
      className="flex flex-wrap gap-2 rounded-lg border border-border bg-bg-surface p-2"
      aria-label="Gutenberg sections"
    >
      {GUTENBERG_IMPORT_TABS.map(({ tab, label, icon, hint }) => {
        const count = counts?.[tab];
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            title={hint}
            onClick={() => selectTab(tab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-[var(--accent)] text-text-primary"
                : "bg-bg-raised text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="mr-1" aria-hidden>
              {icon}
            </span>
            {label}
            {typeof count === "number" ? (
              <span className="ml-1.5 tabular-nums opacity-80">({count})</span>
            ) : null}
          </button>
        );
      })}
      {externalLinks?.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-md bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary"
          title={link.hint}
        >
          <span className="mr-1" aria-hidden>
            {link.icon}
          </span>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
