"use client";

import type { BookStatus } from "@db";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type ChapterListItem = {
  id: string;
  sequenceNumber: number;
  title: string | null;
  rawText: string;
  chunkCount: number;
};

type Props = {
  bookId: string;
  status: BookStatus;
};

const STALE_MSG =
  "Chapters edited — use Finalise Chapters to re-chunk before publishing";

export function ChapterManagerClient({ bookId, status }: Props) {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleErr, setTitleErr] = useState<string | null>(null);
  const [titleOk, setTitleOk] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [staleMsg, setStaleMsg] = useState<string | null>(null);
  const [finaliseBusy, setFinaliseBusy] = useState(false);
  const [finaliseErr, setFinaliseErr] = useState<string | null>(null);

  const loadChapters = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { chapters: ChapterListItem[] };
      setChapters(data.chapters);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load chapters");
      setChapters([]);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (status === "processing") {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadChapters();
  }, [bookId, status, loadChapters]);

  const selected = chapters.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selected) {
      setChapterTitle(selected.title ?? "");
    } else {
      setChapterTitle("");
    }
  }, [selected]);

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

  async function afterStructureChange() {
    setStaleMsg(STALE_MSG);
    setSelectedId("");
    await patchBookDraft();
    await loadChapters();
    router.refresh();
  }

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setTitleErr(null);
    setTitleOk(null);
    setSavingTitle(true);
    try {
      const res = await fetch(
        `/api/admin/books/${bookId}/chapters/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: chapterTitle.trim() === "" ? null : chapterTitle }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as {
        chapter: { title: string | null; id: string };
      };
      setChapters((prev) =>
        prev.map((c) =>
          c.id === data.chapter.id ? { ...c, title: data.chapter.title } : c,
        ),
      );
      setTitleOk("Saved");
      setTimeout(() => setTitleOk(null), 2000);
    } catch (err) {
      setTitleErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingTitle(false);
    }
  }

  async function mergeIntoPrevious() {
    if (!selected) return;
    const idx = chapters.findIndex((c) => c.id === selected.id);
    if (idx <= 0) return;
    const prev = chapters[idx - 1]!;
    setActionErr(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChapterId: selected.id,
          targetChapterId: prev.id,
          mode: "prepend",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await afterStructureChange();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function mergeIntoNext() {
    if (!selected) return;
    const idx = chapters.findIndex((c) => c.id === selected.id);
    if (idx < 0 || idx >= chapters.length - 1) return;
    const next = chapters[idx + 1]!;
    setActionErr(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChapterId: selected.id,
          targetChapterId: next.id,
          mode: "append",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await afterStructureChange();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteChapter() {
    if (!selected) return;
    if (
      !confirm(
        `Delete chapter ${selected.sequenceNumber}${selected.title ? `: ${selected.title}` : ""}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionErr(null);
    setActionBusy(true);
    try {
      const res = await fetch(
        `/api/admin/books/${bookId}/chapters/${selected.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      await afterStructureChange();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function finalise() {
    setFinaliseErr(null);
    setFinaliseBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/finalise`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      setStaleMsg(null);
      await loadChapters();
      router.refresh();
    } catch (e) {
      setFinaliseErr(e instanceof Error ? e.message : "Finalise failed");
    } finally {
      setFinaliseBusy(false);
    }
  }

  const idx = selected
    ? chapters.findIndex((c) => c.id === selected.id)
    : -1;
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < chapters.length - 1;
  const disabled = status === "processing" || actionBusy || finaliseBusy;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/35 p-6 shadow-sm shadow-black/20">
      <h2 className="mb-4 font-serif text-lg font-semibold text-amber-100/90">
        Chapter Manager
      </h2>

      {status === "processing" ? (
        <p className="text-sm text-zinc-500">
          Chapters are not editable while ingestion is running.
        </p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading chapters…</p>
      ) : loadErr ? (
        <p className="text-sm text-red-400">{loadErr}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-[240px] flex-1 space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Chapter
              </span>
              <select
                value={selectedId}
                onChange={async (e) => {
                  const v = e.target.value;
                  setSelectedId(v);
                  setStaleMsg(null);
                  if (v) {
                    await loadChapters();
                  }
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-400/20"
              >
                <option value="">Select a chapter…</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sequenceNumber}. {c.title?.trim() || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {staleMsg ? (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
              {staleMsg}
            </p>
          ) : null}

          {selected ? (
            <div className="space-y-4 border-t border-zinc-800/80 pt-4">
              <form onSubmit={saveTitle} className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Chapter title
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      disabled={disabled}
                      className="min-w-[200px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={disabled || savingTitle}
                      className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 transition hover:bg-zinc-800/90 disabled:opacity-50"
                    >
                      {savingTitle ? "Saving…" : "Save title"}
                    </button>
                  </div>
                </label>
                {titleErr ? (
                  <p className="text-sm text-red-400">{titleErr}</p>
                ) : null}
                {titleOk ? (
                  <p className="text-sm text-emerald-400/90">{titleOk}</p>
                ) : null}
              </form>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Raw text (read-only)
                </span>
                <textarea
                  readOnly
                  value={selected.rawText}
                  className="max-h-[400px] w-full resize-y overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300"
                  rows={12}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || !canPrev}
                  onClick={mergeIntoPrevious}
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 transition hover:bg-zinc-800/90 disabled:opacity-40"
                >
                  Merge into previous
                </button>
                <button
                  type="button"
                  disabled={disabled || !canNext}
                  onClick={mergeIntoNext}
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 transition hover:bg-zinc-800/90 disabled:opacity-40"
                >
                  Merge into next
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={deleteChapter}
                  className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200 ring-1 ring-red-900/60 transition hover:bg-red-900/50 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              {actionErr ? (
                <p className="text-sm text-red-400">{actionErr}</p>
              ) : null}
            </div>
          ) : null}

          {status === "draft" && !loading && chapters.length > 0 ? (
            <div className="mt-6 border-t border-zinc-800/80 pt-4">
              <button
                type="button"
                disabled={disabled || finaliseBusy}
                onClick={finalise}
                className="rounded-lg bg-amber-200/15 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-400/35 transition hover:bg-amber-200/20 disabled:opacity-50"
              >
                {finaliseBusy ? "Finalising…" : "Finalise Chapters"}
              </button>
              <p className="mt-2 text-xs text-zinc-500">
                Re-chunks all chapters, rebuilds embeddings, sets status to
                ready_for_review.
              </p>
              {finaliseErr ? (
                <p className="mt-2 text-sm text-red-400">{finaliseErr}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
