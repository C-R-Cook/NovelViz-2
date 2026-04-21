"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
};

export type ReaderChapter = {
  id: string;
  sequenceNumber: number;
  title: string | null;
};

export type ReaderProgress = {
  currentChapterId: string;
  currentChapterNumber: number;
};

type Props = {
  book: ReaderBook;
  chapters: ReaderChapter[];
  initialProgress: ReaderProgress | null;
};

export function ReaderClient({ book, chapters, initialProgress }: Props) {
  const router = useRouter();
  const total = chapters.length;

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (initialProgress) return initialProgress.currentChapterId;
    if (chapters[0]) return chapters[0].id;
    return "";
  });

  const [savedProgress, setSavedProgress] = useState<ReaderProgress | null>(initialProgress);

  useEffect(() => {
    setSavedProgress(initialProgress);
    if (initialProgress) {
      setSelectedChapterId(initialProgress.currentChapterId);
    } else if (chapters[0]) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [initialProgress, chapters]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  const saveProgress = useCallback(async () => {
    if (!selectedChapterId || !selectedChapter) {
      setMessage({ type: "err", text: "Select a chapter first." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/progress/${book.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapterId,
          chapterNumber: selectedChapter.sequenceNumber,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        progress?: ReaderProgress;
      };
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not save progress" });
        return;
      }
      if (data.progress) {
        setSavedProgress({
          currentChapterId: data.progress.currentChapterId,
          currentChapterNumber: data.progress.currentChapterNumber,
        });
      }
      setMessage({ type: "ok", text: "Progress saved." });
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }, [book.id, selectedChapter, selectedChapterId, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/library"
        className="inline-flex text-sm font-medium text-zinc-600 transition hover:text-amber-800 dark:text-zinc-500 dark:hover:text-amber-200/90"
      >
        ← Back to library
      </Link>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="relative mx-auto w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30 lg:mx-0">
          <div className="relative aspect-[2/3] w-full">
            {book.coverImageUrl ? (
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                fill
                className="object-cover"
                priority
                sizes="280px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-600">
                No cover
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              {book.title}
            </h1>
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">{book.author}</p>
          </div>

          {total === 0 ? (
            <p className="rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              This book hasn&apos;t been ingested yet, check back soon
            </p>
          ) : (
            <section className="space-y-4 rounded-xl border border-zinc-200/90 bg-white/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/30 sm:p-5">
              <h2 className="font-serif text-lg font-semibold text-zinc-900 dark:text-amber-100/90">
                Your Progress
              </h2>

              {savedProgress && total > 0 ? (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  You are reading Chapter {savedProgress.currentChapterNumber} of {total}
                </p>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-500">
                  Set your current chapter below, then save.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Current chapter
                  </span>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                  >
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sequenceNumber}. {c.title?.trim() || "Untitled"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={saveProgress}
                  disabled={saving || !selectedChapterId}
                  className="shrink-0 rounded-lg border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-200/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:bg-amber-950/50"
                >
                  {saving ? "Saving…" : "Save Progress"}
                </button>
              </div>

              {message ? (
                <p
                  className={
                    message.type === "ok"
                      ? "text-sm text-emerald-700 dark:text-emerald-400/90"
                      : "text-sm text-red-600 dark:text-red-400"
                  }
                >
                  {message.text}
                </p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
