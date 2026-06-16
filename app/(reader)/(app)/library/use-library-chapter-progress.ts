"use client";

import type { LibraryBookRow, LibraryProgress } from "./library-types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Sentinel value for the chapter dropdown when the reader has not saved progress. */
export const NOT_STARTED_CHAPTER_ID = "__not_started__";

export function useLibraryChapterProgress(
  book: LibraryBookRow | null,
  initialProgress: LibraryProgress | null,
) {
  const router = useRouter();
  const chapters = useMemo(() => book?.chapters ?? [], [book?.chapters]);
  const total = chapters.length;

  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [savedProgress, setSavedProgress] = useState<LibraryProgress | null>(initialProgress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!book) {
      setSelectedChapterId("");
      setSavedProgress(null);
      return;
    }
    setSavedProgress(initialProgress);
    if (initialProgress) {
      setSelectedChapterId(initialProgress.currentChapterId);
    } else {
      setSelectedChapterId(NOT_STARTED_CHAPTER_ID);
    }
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when active book changes
  }, [book?.bookId, initialProgress]);

  const isNotStarted = selectedChapterId === NOT_STARTED_CHAPTER_ID;
  const selectedChapter = isNotStarted
    ? undefined
    : chapters.find((c) => c.id === selectedChapterId);
  const chapterNumber = isNotStarted
    ? 0
    : (selectedChapter?.sequenceNumber ?? savedProgress?.currentChapterNumber ?? 0);
  const progressPercent =
    total > 0 && !isNotStarted
      ? Math.min(100, Math.round((chapterNumber / total) * 100))
      : 0;

  const selectChapter = useCallback(
    async (chapterId: string) => {
      if (!book) return;

      setSelectedChapterId(chapterId);

      if (chapterId === NOT_STARTED_CHAPTER_ID) {
        if (!savedProgress) {
          setMessage(null);
          return;
        }

        setSaving(true);
        setMessage(null);
        try {
          const res = await fetch(`/api/progress/${book.bookId}`, { method: "DELETE" });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setMessage({ type: "err", text: data.error || "Could not clear progress" });
            setSelectedChapterId(savedProgress.currentChapterId);
            return;
          }
          setSavedProgress(null);
          router.refresh();
        } catch {
          setMessage({ type: "err", text: "Network error. Try again." });
          setSelectedChapterId(savedProgress.currentChapterId);
        } finally {
          setSaving(false);
        }
        return;
      }

      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) return;

      if (savedProgress?.currentChapterId === chapterId) {
        setMessage(null);
        return;
      }

      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/progress/${book.bookId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId,
            chapterNumber: chapter.sequenceNumber,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          progress?: LibraryProgress;
        };
        if (!res.ok) {
          setMessage({ type: "err", text: data.error || "Could not save progress" });
          setSelectedChapterId(
            savedProgress?.currentChapterId ?? NOT_STARTED_CHAPTER_ID,
          );
          return;
        }
        if (data.progress) {
          setSavedProgress({
            currentChapterId: data.progress.currentChapterId,
            currentChapterNumber: data.progress.currentChapterNumber,
            updatedAt: new Date().toISOString(),
          });
        }
        router.refresh();
      } catch {
        setMessage({ type: "err", text: "Network error. Try again." });
        setSelectedChapterId(savedProgress?.currentChapterId ?? NOT_STARTED_CHAPTER_ID);
      } finally {
        setSaving(false);
      }
    },
    [book, chapters, savedProgress, router],
  );

  return {
    chapters,
    total,
    selectedChapterId,
    selectChapter,
    savedProgress,
    saving,
    message,
    chapterNumber,
    progressPercent,
    isNotStarted,
  };
}
