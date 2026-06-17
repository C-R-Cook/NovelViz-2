"use client";

import { FlaggedCommentsQueue } from "@/app/(reader)/(app)/dashboard/flagged-comments-queue";
import { SpoilerCommentsQueue } from "@/app/(reader)/(app)/dashboard/spoiler-comments-queue";
import type { AdminFlaggedCommentRow } from "@/lib/admin-flagged-comments-queue";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import {
  parseCommentModerationFilter,
  type CommentModerationFilter,
} from "@/lib/dashboard-tab";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type CommentModerationQueueProps = {
  spoilerItems: AdminSpoilerCommentRow[];
  flaggedItems: AdminFlaggedCommentRow[];
  spoilerCount: number;
  flaggedCount: number;
  className?: string;
};

const FILTER_OPTIONS: { value: CommentModerationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spoiler", label: "Spoiler" },
  { value: "flagged", label: "Flagged" },
];

function filterLabel(value: CommentModerationFilter, spoilerCount: number, flaggedCount: number): string {
  if (value === "all") return "All";
  if (value === "spoiler") return `Spoiler (${spoilerCount})`;
  return `Flagged (${flaggedCount})`;
}

export function CommentModerationQueue({
  spoilerItems,
  flaggedItems,
  spoilerCount,
  flaggedCount,
  className,
}: CommentModerationQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const legacyFilter =
    rawTab === "spoiler-comments" ? "spoiler" : rawTab === "flagged-comments" ? "flagged" : null;
  const filter = legacyFilter ?? parseCommentModerationFilter(searchParams.get("filter"));

  const setFilter = useCallback(
    (next: CommentModerationFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "comment-moderation");
      if (next === "all") {
        params.delete("filter");
      } else {
        params.set("filter", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const showSpoiler = filter === "all" || filter === "spoiler";
  const showFlagged = filter === "all" || filter === "flagged";

  return (
    <div className={className ? `${className} space-y-6` : "space-y-6"}>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Comment moderation filter"
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[var(--accent)] text-text-primary"
                  : "bg-bg-raised text-text-secondary hover:text-text-primary"
              }`}
            >
              {filterLabel(opt.value, spoilerCount, flaggedCount)}
            </button>
          );
        })}
      </div>

      {showSpoiler ? (
        <SpoilerCommentsQueue
          items={spoilerItems}
          className="dashboard-spoiler-comments-wrap dashboard-admin-queue-wrap"
        />
      ) : null}

      {showFlagged ? (
        <FlaggedCommentsQueue
          items={flaggedItems}
          className="dashboard-flagged-comments-wrap dashboard-admin-queue-wrap"
        />
      ) : null}
    </div>
  );
}
