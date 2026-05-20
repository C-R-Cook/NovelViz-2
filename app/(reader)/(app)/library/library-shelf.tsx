"use client";

import Image from "next/image";
import Link from "next/link";
import { useDragScroll } from "@/lib/use-drag-scroll";
import type { LibraryBookRow } from "./library-types";
import { useState } from "react";

function ShelfCoverImage({ src, title }: { src: string; title: string }) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return (
      <div className="library-shelf-cover-fallback" aria-hidden>
        {title.slice(0, 2)}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      className="object-cover"
      sizes="64px"
      onError={() => setBad(true)}
    />
  );
}

function shelfProgressPercent(book: LibraryBookRow): number {
  const total = book.chapterTotal;
  if (total <= 0) return 0;
  const ch = book.progress?.currentChapterNumber ?? 0;
  return Math.min(100, Math.round((ch / total) * 100));
}

type Props = {
  books: LibraryBookRow[];
  activeBookId: string;
  onSelectBook: (bookId: string) => void;
  reducedMotion: boolean;
  finePointer: boolean;
};

export function LibraryShelf({
  books,
  activeBookId,
  onSelectBook,
  reducedMotion,
  finePointer,
}: Props) {
  const {
    setScrollerRef,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    shouldIgnoreClick,
  } = useDragScroll({
    enabled: finePointer && !reducedMotion,
    ignoreSelector: ".library-shelf-card, .library-active-book-bar, .library-active-book-bar *",
  });

  return (
    <div
      ref={setScrollerRef}
      className={`library-shelf-row library-no-h-scrollbar ${dragging ? "library-shelf-row--dragging" : ""}`}
      onPointerDownCapture={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      {books.map((book) => {
        const active = book.bookId === activeBookId;
        const pct = shelfProgressPercent(book);
        return (
          <button
            key={book.bookId}
            type="button"
            className={`library-shelf-card ${active ? "library-shelf-card--active" : ""}`}
            aria-pressed={active}
            aria-label={`${book.title} by ${book.author}`}
            onClick={() => {
              if (shouldIgnoreClick()) return;
              onSelectBook(book.bookId);
            }}
          >
            {active ? <span className="library-shelf-card-gem" aria-hidden>✦</span> : null}
            <div className="library-shelf-card-cover">
              {book.coverImageUrl ? (
                <ShelfCoverImage src={book.coverImageUrl} title={book.title} />
              ) : (
                <div className="library-shelf-cover-fallback">{book.title}</div>
              )}
              <div
                className="library-shelf-card-progress"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="library-shelf-card-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="library-shelf-card-title">{book.title}</span>
          </button>
        );
      })}
      <Link href="/books" className="library-shelf-add" aria-label="Add book">
        <span className="library-shelf-add-plus">+</span>
        <span className="library-shelf-add-label">ADD BOOK</span>
      </Link>
    </div>
  );
}
