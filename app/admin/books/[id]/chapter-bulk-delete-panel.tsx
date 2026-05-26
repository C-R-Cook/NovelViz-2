"use client";

import type { ChapterListItem } from "./chapter-manager-client";
import type { BookStatus } from "@db";
import { useEffect, useMemo, useState } from "react";

function chapterDisplayTitle(c: ChapterListItem): string {
  return c.title?.trim() || "Untitled";
}

const BULK_DELETE_MAX = 40;

function titleMatchesQuery(title: string | null, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (title ?? "").toLowerCase().includes(q);
}

type Props = {
  bookId: string;
  status: BookStatus;
  chapters: ChapterListItem[];
  loading: boolean;
  loadErr: string | null;
  disabled: boolean;
  skipDraftOnStructureChange?: boolean;
  onChaptersUpdated: (chapters: ChapterListItem[]) => void;
};

export function ChapterBulkDeletePanel({
  bookId,
  status,
  chapters,
  loading,
  loadErr,
  disabled,
  skipDraftOnStructureChange = false,
  onChaptersUpdated,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteOk, setDeleteOk] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  const visibleChapters = useMemo(() => {
    if (!trimmedQuery) return chapters;
    return chapters.filter((c) => titleMatchesQuery(c.title, trimmedQuery));
  }, [chapters, trimmedQuery]);

  const matchIds = useMemo(() => new Set(visibleChapters.map((c) => c.id)), [visibleChapters]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (matchIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [matchIds]);

  const selectedCount = selected.size;
  const allVisibleSelected =
    visibleChapters.length > 0 && visibleChapters.every((c) => selected.has(c.id));
  const wouldDeleteAll = selectedCount > 0 && selectedCount >= chapters.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(visibleChapters.map((c) => c.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function patchBookDraft() {
    const res = await fetch(`/api/admin/books/${bookId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || res.statusText);
    }
  }

  async function deleteSelected() {
    if (selectedCount === 0) return;
    if (wouldDeleteAll) {
      setDeleteErr("At least one chapter must remain on the book.");
      return;
    }

    const labels = visibleChapters
      .filter((c) => selected.has(c.id))
      .slice(0, 8)
      .map((c) => `#${c.sequenceNumber} ${chapterDisplayTitle(c)}`);
    const more = selectedCount > 8 ? ` and ${selectedCount - 8} more` : "";

    if (
      !confirm(
        `Delete ${selectedCount} chapter${selectedCount === 1 ? "" : "s"}?\n\n${labels.join("\n")}${more}\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleteBusy(true);
    setDeleteErr(null);
    setDeleteOk(null);
    try {
      const ids = [...selected];
      let deleted = 0;
      const failed: Array<{ chapterId: string; error: string }> = [];
      let latestChapters: ChapterListItem[] | undefined;

      for (let i = 0; i < ids.length; i += BULK_DELETE_MAX) {
        const batch = ids.slice(i, i + BULK_DELETE_MAX);
        const res = await fetch(`/api/admin/books/${bookId}/chapters/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterIds: batch }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          deletedCount?: number;
          failed?: Array<{ chapterId: string; error: string }>;
          chapters?: ChapterListItem[];
        };
        if (!res.ok) {
          throw new Error(data.error || res.statusText);
        }
        deleted += data.deletedCount ?? 0;
        if (data.failed?.length) failed.push(...data.failed);
        if (data.chapters) latestChapters = data.chapters;
      }

      if (latestChapters) {
        onChaptersUpdated(latestChapters);
      }

      if (!skipDraftOnStructureChange) {
        await patchBookDraft();
      }

      setSelected(new Set());

      if (failed.length > 0) {
        setDeleteErr(
          `Deleted ${deleted}; ${failed.length} failed. First error: ${failed[0]!.error}`,
        );
      } else {
        setDeleteOk(`Deleted ${deleted} chapter${deleted === 1 ? "" : "s"}.`);
      }
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (status === "processing") {
    return (
      <p className="text-sm text-text-muted">Chapters cannot be edited while ingestion is running.</p>
    );
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading chapters…</p>;
  }

  if (loadErr) {
    return <p className="text-sm text-error">{loadErr}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Browse all {chapters.length} chapters, filter by title, select rows, then delete in bulk. At least
        one chapter must remain.
      </p>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Title contains (optional)
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. Contents'
          className="w-full max-w-md rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
        />
      </label>

      {trimmedQuery ? (
        <p className="text-sm text-text-secondary">
          <span className="font-medium tabular-nums text-text-primary">{visibleChapters.length}</span> of{" "}
          {chapters.length} chapters match
        </p>
      ) : null}

      {chapters.length === 0 ? (
        <p className="text-sm text-text-muted">No chapters on this book.</p>
      ) : visibleChapters.length === 0 ? (
        <p className="text-sm text-text-muted">No chapters match that filter.</p>
      ) : (
        <div className="rounded-xl border border-border bg-bg-base/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-text-primary">
              {selectedCount} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled || deleteBusy}
                onClick={selectAllVisible}
                className="rounded-lg border border-border bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-surface disabled:opacity-50"
              >
                {allVisibleSelected ? "All visible selected" : "Select all visible"}
              </button>
              <button
                type="button"
                disabled={disabled || deleteBusy || selectedCount === 0}
                onClick={clearSelection}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={disabled || deleteBusy || selectedCount === 0 || wouldDeleteAll}
                onClick={() => void deleteSelected()}
                className="rounded-lg bg-error/15 px-3 py-1.5 text-xs font-medium text-error ring-1 ring-error/35 hover:bg-error/25 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : `Delete selected (${selectedCount})`}
              </button>
            </div>
          </div>
          <ul className="max-h-[min(60vh,520px)] divide-y divide-border overflow-y-auto">
            {visibleChapters.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-bg-surface/60">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || deleteBusy}
                      onChange={() => toggleOne(c.id)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-text-primary">
                        <span className="tabular-nums text-text-muted">#{c.sequenceNumber}</span>{" "}
                        {chapterDisplayTitle(c)}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {c.chunkCount.toLocaleString()} search chunks
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {wouldDeleteAll ? (
        <p className="text-sm text-error">You cannot delete every chapter — leave at least one.</p>
      ) : null}
      {deleteErr ? <p className="text-sm text-error">{deleteErr}</p> : null}
      {deleteOk ? <p className="text-sm text-success">{deleteOk}</p> : null}
    </div>
  );
}
