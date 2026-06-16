"use client";

import Image from "next/image";
import type { LibraryBookRow } from "./library-types";
import { NOT_STARTED_CHAPTER_ID } from "./use-library-chapter-progress";

type ChapterProgress = {
  selectedChapterId: string;
  selectChapter: (chapterId: string) => void;
  saving: boolean;
  message: { type: "ok" | "err"; text: string } | null;
  chapterNumber: number;
  progressPercent: number;
  total: number;
  isNotStarted: boolean;
};

type Props = {
  book: LibraryBookRow;
  chapters: { id: string; sequenceNumber: number; title: string | null }[];
  progress: ChapterProgress;
};

export function LibraryActiveBookBar({ book, chapters, progress }: Props) {
  const {
    selectedChapterId,
    selectChapter,
    saving,
    message,
    progressPercent,
    total,
    chapterNumber,
    isNotStarted,
  } = progress;

  if (total === 0) {
    return (
      <div className="library-active-book-bar">
        <p className="text-xs text-text-muted">This book hasn&apos;t been ingested yet.</p>
      </div>
    );
  }

  return (
    <div className="library-active-book-bar">
      <div className="library-active-book-bar-cover">
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="88px"
          />
        ) : (
          <span className="library-active-book-bar-cover-fallback" aria-hidden>
            {book.title.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="library-active-book-bar-meta">
        <p className="library-active-book-bar-title">{book.title}</p>
        <p className="library-active-book-bar-author">{book.author}</p>
        <div className="library-active-book-bar-progress-row">
          <div
            className="library-active-book-bar-progress"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="library-active-book-bar-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="library-active-book-bar-progress-label">
            {isNotStarted
              ? `Not started · ${progressPercent}%`
              : `Ch. ${chapterNumber} / ${total} · ${progressPercent}%`}
          </span>
        </div>
        <label className="library-active-book-bar-chapter-label">
          <span className="library-active-book-bar-chapter-heading">Current chapter</span>
          <select
            value={selectedChapterId}
            onChange={(e) => void selectChapter(e.target.value)}
            disabled={saving || !selectedChapterId || book.removedFromCatalogue}
            className="library-active-book-bar-select"
            aria-busy={saving}
            aria-disabled={book.removedFromCatalogue}
          >
            <option value={NOT_STARTED_CHAPTER_ID}>* Not Started *</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title?.trim() || "Untitled"}
              </option>
            ))}
          </select>
        </label>
        {message?.type === "err" ? (
          <p className="library-active-book-bar-message library-active-book-bar-message--err" role="alert">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
