// TODO: deprecated — functionality moved to /dashboard tabs
"use client";

import type { BookStatus } from "@db";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  /** Admin editor: do not demote the book to draft after chapter structure changes. */
  skipDraftOnStructureChange?: boolean;
};

const STALE_MSG = "Chapters edited — the book stays in draft until you submit for review.";

export function ChapterManagerClient({
  bookId,
  status,
  skipDraftOnStructureChange = false,
}: Props) {
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
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [chapterMenuMounted, setChapterMenuMounted] = useState(false);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const chapterPickerRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLUListElement>(null);

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
    setChapterMenuMounted(true);
  }, []);

  const updatePickerRect = useCallback(() => {
    const el = chapterPickerRef.current;
    if (!el) return;
    setPickerRect(el.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!chapterPickerOpen) {
      setPickerRect(null);
      return;
    }
    updatePickerRect();
    window.addEventListener("resize", updatePickerRect);
    window.addEventListener("scroll", updatePickerRect, true);
    return () => {
      window.removeEventListener("resize", updatePickerRect);
      window.removeEventListener("scroll", updatePickerRect, true);
    };
  }, [chapterPickerOpen, updatePickerRect]);

  useEffect(() => {
    if (!chapterPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (chapterPickerRef.current?.contains(target)) return;
      if (chapterMenuRef.current?.contains(target)) return;
      setChapterPickerOpen(false);
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
    setStaleMsg(skipDraftOnStructureChange ? null : STALE_MSG);
    setSelectedId("");
    if (!skipDraftOnStructureChange) {
      await patchBookDraft();
    }
    await loadChapters();
    if (!skipDraftOnStructureChange) {
      router.refresh();
    }
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

  async function renumberAllChapters() {
    if (
      !confirm(
        "Renumber all chapters to 1, 2, 3, … in creation order? Use this to fix gaps in chapter numbers.",
      )
    ) {
      return;
    }
    setActionErr(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters/renumber`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { chapters: ChapterListItem[] };
      setChapters(data.chapters);
      setSelectedId("");
      if (!skipDraftOnStructureChange) {
        setStaleMsg(STALE_MSG);
        await patchBookDraft();
      } else {
        setStaleMsg(null);
      }
      router.refresh();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Renumber failed");
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
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        chapters?: ChapterListItem[];
      };
      if (!res.ok) {
        const msg =
          j.error ||
          (res.status === 504
            ? "Delete timed out — try again in a moment."
            : res.statusText || "Delete failed");
        throw new Error(msg);
      }
      if (j.chapters) {
        setChapters(j.chapters);
        setSelectedId("");
        setStaleMsg(skipDraftOnStructureChange ? null : STALE_MSG);
        if (!skipDraftOnStructureChange) {
          await patchBookDraft();
        }
        if (!skipDraftOnStructureChange) {
          router.refresh();
        }
      } else {
        await afterStructureChange();
      }
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionBusy(false);
    }
  }

  const idx = selected
    ? chapters.findIndex((c) => c.id === selected.id)
    : -1;
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < chapters.length - 1;
  const disabled = status === "processing" || actionBusy;

  const chapterListMenu =
    chapterPickerOpen && pickerRect && chapterMenuMounted ? (
      <ul
        ref={chapterMenuRef}
        role="listbox"
        aria-labelledby="chapter-manager-label"
        style={(() => {
          const gap = 4;
          const maxMenuHeight = 320;
          const spaceBelow = window.innerHeight - pickerRect.bottom - gap;
          const spaceAbove = pickerRect.top - gap;
          const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
          const maxHeight = Math.min(
            maxMenuHeight,
            openUp ? spaceAbove : spaceBelow,
            window.innerHeight * 0.5,
          );
          return {
            position: "fixed" as const,
            left: pickerRect.left,
            width: pickerRect.width,
            top: openUp ? undefined : pickerRect.bottom + gap,
            bottom: openUp ? window.innerHeight - pickerRect.top + gap : undefined,
            maxHeight: Math.max(120, maxHeight),
            zIndex: 250,
          };
        })()}
        className="overflow-y-auto overscroll-contain rounded-lg border border-border bg-bg-surface py-1 shadow-lg shadow-bg-overlay/15 ring-1 ring-border"
      >
        <li role="none">
          <button
            type="button"
            role="option"
            aria-selected={selectedId === ""}
            className="w-full px-3 py-2 text-left text-sm text-text-muted transition hover:bg-bg-surface hover:text-text-primary"
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
              className={`w-full px-3 py-2 text-left text-sm transition hover:bg-bg-surface ${
                selectedId === c.id
                  ? "bg-accent-muted text-text-primary"
                  : "text-text-primary"
              }`}
              onClick={async () => {
                setSelectedId(c.id);
                setStaleMsg(null);
                setChapterPickerOpen(false);
                await loadChapters();
              }}
            >
              {c.title?.trim() || "Untitled"}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <section className="chapter-manager-root rounded-xl border border-border bg-bg-surface/85 p-6 shadow-sm shadow-bg-overlay/5">
      <h2 className="mb-4 font-serif text-lg font-semibold text-accent-text">
        Chapter Manager
      </h2>

      {status === "processing" ? (
        <p className="text-sm text-text-muted">
          Chapters are not editable while ingestion is running.
        </p>
      ) : loading ? (
        <p className="text-sm text-text-muted">Loading chapters…</p>
      ) : loadErr ? (
        <p className="text-sm text-error">{loadErr}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <button
              type="button"
              disabled={disabled || actionBusy}
              onClick={() => void renumberAllChapters()}
              className="shrink-0 rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
              title="Fix chapter numbers starting at 2 or with gaps"
            >
              Renumber 1…n
            </button>
            <div className="block min-w-0 w-full flex-1 space-y-1.5 sm:min-w-[240px]">
              <span
                id="chapter-manager-label"
                className="text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                Chapter
              </span>
              <div ref={chapterPickerRef} className="relative">
                <button
                  type="button"
                  id="chapter-manager-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={chapterPickerOpen}
                  aria-labelledby="chapter-manager-label chapter-manager-trigger"
                  disabled={disabled}
                  onClick={() => setChapterPickerOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-left text-sm text-text-primary outline-none ring-accent/0 transition focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {selected
                      ? selected.title?.trim() || "Untitled"
                      : "Select a chapter…"}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${chapterPickerOpen ? "rotate-180" : ""}`}
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
              </div>
            </div>
          </div>

          {staleMsg ? (
            <p className="mb-4 rounded-lg border border-accent/35 bg-accent-muted px-3 py-2 text-sm text-text-primary">
              {staleMsg}
            </p>
          ) : null}

          {selected ? (
            <div className="space-y-4 border-t border-border pt-4">
              <form onSubmit={saveTitle} className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Chapter title
                  </span>
                  <div className="chapter-manager-title-row flex flex-wrap items-center gap-2">
                    <input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      disabled={disabled}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-50 sm:min-w-[200px]"
                    />
                    <button
                      type="submit"
                      disabled={disabled || savingTitle}
                      className="rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
                    >
                      {savingTitle ? "Saving…" : "Save title"}
                    </button>
                  </div>
                </label>
                {titleErr ? (
                  <p className="text-sm text-error">{titleErr}</p>
                ) : null}
                {titleOk ? (
                  <p className="text-sm text-success">{titleOk}</p>
                ) : null}
              </form>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Raw text (read-only)
                </span>
                <textarea
                  readOnly
                  value={selected.rawText}
                  className="max-h-[400px] w-full resize-y overflow-auto rounded-lg border border-border bg-bg-base px-3 py-2 font-mono text-xs leading-relaxed text-text-primary"
                  rows={12}
                />
              </label>

              <div className="chapter-manager-merge-actions flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || !canPrev}
                  onClick={mergeIntoPrevious}
                  className="rounded-lg bg-bg-raised px-3 py-2 text-sm text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-40"
                >
                  Merge into previous
                </button>
                <button
                  type="button"
                  disabled={disabled || !canNext}
                  onClick={mergeIntoNext}
                  className="rounded-lg bg-bg-raised px-3 py-2 text-sm text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-40"
                >
                  Merge into next
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void deleteChapter()}
                  className="rounded-lg bg-error/15 px-3 py-2 text-sm text-error ring-1 ring-error/35 transition hover:bg-error/25 disabled:opacity-40"
                >
                  {actionBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
              {actionErr ? (
                <p className="text-sm text-error">{actionErr}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {chapterMenuMounted && chapterListMenu
        ? createPortal(chapterListMenu, document.body)
        : null}
    </section>
  );
}
