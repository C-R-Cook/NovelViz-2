"use client";

import type { BookStatus } from "@db";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const chapterPickerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!chapterPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      const el = chapterPickerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setChapterPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [chapterPickerOpen]);

  useEffect(() => {
    if (!chapterPickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setChapterPickerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chapterPickerOpen]);

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
    <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/35 dark:shadow-black/20">
      <h2 className="mb-4 font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">
        Chapter Manager
      </h2>

      {status === "processing" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-500">
          Chapters are not editable while ingestion is running.
        </p>
      ) : loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-500">Loading chapters…</p>
      ) : loadErr ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadErr}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="block min-w-[240px] flex-1 space-y-1.5">
              <span
                id="chapter-manager-label"
                className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500"
              >
                Chapter
              </span>
              <div ref={chapterPickerRef} className="relative z-20">
                <button
                  type="button"
                  id="chapter-manager-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={chapterPickerOpen}
                  aria-labelledby="chapter-manager-label chapter-manager-trigger"
                  disabled={disabled}
                  onClick={() => setChapterPickerOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 outline-none ring-amber-400/0 transition focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {selected
                      ? `${selected.sequenceNumber}. ${selected.title?.trim() || "Untitled"}`
                      : "Select a chapter…"}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform dark:text-zinc-500 ${chapterPickerOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {chapterPickerOpen ? (
                  <ul
                    role="listbox"
                    aria-labelledby="chapter-manager-label"
                    className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-[min(50vh,20rem)] overflow-y-auto overscroll-contain rounded-lg border border-zinc-300 bg-white py-1 shadow-lg shadow-zinc-900/15 ring-1 ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/50 dark:ring-zinc-800/80"
                  >
                    <li role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedId === ""}
                        className="w-full px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                        onClick={async () => {
                          setSelectedId("");
                          setStaleMsg(null);
                          setChapterPickerOpen(false);
                        }}
                      >
                        Select a chapter…
                      </button>
                    </li>
                    {chapters.map((c) => (
                      <li key={c.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedId === c.id}
                          className={`w-full px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                            selectedId === c.id
                              ? "bg-amber-100 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                          onClick={async () => {
                            setSelectedId(c.id);
                            setStaleMsg(null);
                            setChapterPickerOpen(false);
                            await loadChapters();
                          }}
                        >
                          {c.sequenceNumber}. {c.title?.trim() || "Untitled"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          {staleMsg ? (
            <p className="mb-4 rounded-lg border border-amber-600/35 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100/95">
              {staleMsg}
            </p>
          ) : null}

          {selected ? (
            <div className="space-y-4 border-t border-zinc-200/90 pt-4 dark:border-zinc-800/80">
              <form onSubmit={saveTitle} className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Chapter title
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      disabled={disabled}
                      className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                    />
                    <button
                      type="submit"
                      disabled={disabled || savingTitle}
                      className="rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
                    >
                      {savingTitle ? "Saving…" : "Save title"}
                    </button>
                  </div>
                </label>
                {titleErr ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{titleErr}</p>
                ) : null}
                {titleOk ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400/90">{titleOk}</p>
                ) : null}
              </form>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                  Raw text (read-only)
                </span>
                <textarea
                  readOnly
                  value={selected.rawText}
                  className="max-h-[400px] w-full resize-y overflow-auto rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300"
                  rows={12}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || !canPrev}
                  onClick={mergeIntoPrevious}
                  className="rounded-lg bg-zinc-200 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
                >
                  Merge into previous
                </button>
                <button
                  type="button"
                  disabled={disabled || !canNext}
                  onClick={mergeIntoNext}
                  className="rounded-lg bg-zinc-200 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
                >
                  Merge into next
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={deleteChapter}
                  className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900 ring-1 ring-red-300/80 transition hover:bg-red-200/80 disabled:opacity-40 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900/60 dark:hover:bg-red-900/50"
                >
                  Delete
                </button>
              </div>
              {actionErr ? (
                <p className="text-sm text-red-600 dark:text-red-400">{actionErr}</p>
              ) : null}
            </div>
          ) : null}

          {status === "draft" && !loading && chapters.length > 0 ? (
            <div className="mt-6 border-t border-zinc-200/90 pt-4 dark:border-zinc-800/80">
              <button
                type="button"
                disabled={disabled || finaliseBusy}
                onClick={finalise}
                className="rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/40 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/35 dark:hover:bg-amber-200/20"
              >
                {finaliseBusy ? "Finalising…" : "Finalise Chapters"}
              </button>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-500">
                Re-chunks all chapters, rebuilds embeddings, sets status to
                pending_review.
              </p>
              {finaliseErr ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{finaliseErr}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
