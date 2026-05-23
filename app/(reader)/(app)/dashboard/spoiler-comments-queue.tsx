"use client";

import { formatSpoilerCheckResultLabel } from "@/lib/comment-spoiler-scan-debug";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import { SpoilerReviewGalleryModal } from "@/components/gallery/spoiler-review-gallery-modal";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModerateAction = "reinstate" | "confirm_spoiler";
type ConfirmDisposition = "keep" | "delete";

export function SpoilerCommentsQueue({
  items: initialItems,
  className,
}: {
  items: AdminSpoilerCommentRow[];
  className?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<AdminSpoilerCommentRow | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAtMs - a.createdAtMs),
    [items],
  );

  async function moderate(
    commentId: string,
    action: ModerateAction,
    disposition?: ConfirmDisposition,
  ) {
    setActionError(null);
    setActionId(commentId);
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "confirm_spoiler" ? { disposition: disposition ?? "keep" } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(data.error ?? "Moderation failed");
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== commentId));
    } catch {
      setActionError("Moderation failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <section
      aria-labelledby="spoiler-comments-queue-heading"
      className={className ? `${className} space-y-4` : "space-y-4"}
    >
      <div>
        <h2 id="spoiler-comments-queue-heading" className="text-lg font-semibold text-text-primary">
          Spoiler comments
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Comments auto-hidden as possible spoilers ({sorted.length} awaiting review). Release if not a
          spoiler, confirm to keep gated by chapter, or remove entirely.
        </p>
      </div>

      {actionError ? (
        <p className="text-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">No spoiler-flagged comments need review.</p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((row) => {
            const busy = actionId === row.id;
            const gate =
              row.spoilerGateChapter ??
              row.spoilerScanDebug?.spoilerChapter ??
              row.chapterNumberAtTime;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-border/80 bg-bg-base/80 p-4 shadow-sm"
              >
                <div className="flex flex-wrap gap-4">
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
                    <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="56px" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-text-primary">{row.bookTitle}</span>
                      <span className="text-sm text-text-muted">· {row.bookAuthor}</span>
                    </div>
                    <p className="text-xs text-text-muted">
                      Image ch. {row.chapterNumberAtTime}
                      {gate != null ? ` · gate ch. ${gate}` : null} · {row.username} ·{" "}
                      <time dateTime={new Date(row.createdAtMs).toISOString()}>
                        {formatActivityAtUtc(new Date(row.createdAtMs))}
                      </time>
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-text-primary">{row.content}</p>
                    {row.spoilerScanDebug ? (
                      <p className="border-t border-dashed border-border pt-2 font-mono text-[11px] text-text-muted">
                        {formatSpoilerCheckResultLabel(row.spoilerScanDebug)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="dashboard-admin-queue-actions mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void moderate(row.id, "reinstate")}
                    className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-success/90 disabled:opacity-50"
                  >
                    {busy ? "…" : "Not a spoiler (release)"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void moderate(row.id, "confirm_spoiler", "keep")}
                    className="rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-raised disabled:opacity-50"
                  >
                    {busy ? "…" : "Confirm — keep gated"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void moderate(row.id, "confirm_spoiler", "delete")}
                    className="rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/20 disabled:opacity-50"
                  >
                    {busy ? "…" : "Confirm — remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewRow(row)}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-accent-text underline-offset-2 transition hover:bg-bg-raised hover:underline"
                  >
                    View in gallery
                  </button>
                  <Link
                    href={`/admin/books/${row.bookId}`}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-surface"
                  >
                    Book admin
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {previewRow ? (
        <SpoilerReviewGalleryModal row={previewRow} onClose={() => setPreviewRow(null)} />
      ) : null}
    </section>
  );
}
