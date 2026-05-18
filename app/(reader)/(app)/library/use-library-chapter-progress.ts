"use client";

import type { LibraryBookRow, LibraryProgress } from "./library-types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useLibraryChapterProgress(
  book: LibraryBookRow | null,
  initialProgress: LibraryProgress | null,
) {
  const router = useRouter();
  const chapters = book?.chapters ?? [];
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
    } else if (book.chapters[0]) {
      setSelectedChapterId(book.chapters[0].id);
    } else {
      setSelectedChapterId("");
    }
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when active book changes
  }, [book?.bookId, initialProgress]);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const chapterNumber =
    selectedChapter?.sequenceNumber ?? savedProgress?.currentChapterNumber ?? 1;
  const progressPercent =
    total > 0 ? Math.min(100, Math.round((chapterNumber / total) * 100)) : 0;

  const selectChapter = useCallback(
    async (chapterId: string) => {
      if (!book) return;
      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) return;

      setSelectedChapterId(chapterId);

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
      } finally {
        setSaving(false);
      }
    },
    [book, chapters, savedProgress?.currentChapterId, router],
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
  };
}
