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

type ShelfBookCardProps = {
  book: LibraryBookRow;
  active: boolean;
  onSelect: () => void;
  shouldIgnoreClick: () => boolean;
  variant?: "current" | "library";
};

function ShelfBookCard({
  book,
  active,
  onSelect,
  shouldIgnoreClick,
  variant = "library",
}: ShelfBookCardProps) {
  const pct = shelfProgressPercent(book);

  return (
    <button
      type="button"
      className={`library-shelf-card ${active ? "library-shelf-card--active" : ""} ${
        variant === "current" ? "library-shelf-card--current" : ""
      }`}
      aria-pressed={active}
      aria-label={`${book.title} by ${book.author}`}
      aria-current={variant === "current" ? "true" : undefined}
      onClick={() => {
        if (shouldIgnoreClick()) return;
        onSelect();
      }}
    >
      {active && variant === "library" ? (
        <span className="library-shelf-card-gem" aria-hidden>
          ✦
        </span>
      ) : null}
      {variant === "library" ? (
        <span className="library-shelf-slot-label" aria-hidden />
      ) : null}
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
          <div
            className="library-shelf-card-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="library-shelf-card-title">{book.title}</span>
    </button>
  );
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
    ignoreSelector:
      ".library-shelf-card, .library-shelf-add, .library-shelf-current, .library-active-book-bar, .library-active-book-bar *",
  });

  const currentBook =
    books.find((book) => book.bookId === activeBookId) ?? books[0] ?? null;
  const libraryBooks = currentBook
    ? books.filter((book) => book.bookId !== currentBook.bookId)
    : books;

  return (
    <div className="library-shelf-layout">
      {currentBook ? (
        <div className="library-shelf-current">
          <p className="library-shelf-current-label">Now reading</p>
          <ShelfBookCard
            book={currentBook}
            active
            variant="current"
            onSelect={() => onSelectBook(currentBook.bookId)}
            shouldIgnoreClick={shouldIgnoreClick}
          />
        </div>
      ) : null}

      <div
        ref={setScrollerRef}
        className={`library-shelf-row library-no-h-scrollbar ${dragging ? "library-shelf-row--dragging" : ""}`}
        onPointerDownCapture={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      >
        {libraryBooks.map((book) => (
          <ShelfBookCard
            key={book.bookId}
            book={book}
            active={book.bookId === activeBookId}
            onSelect={() => onSelectBook(book.bookId)}
            shouldIgnoreClick={shouldIgnoreClick}
          />
        ))}
        <Link
          href="/discover"
          className="library-shelf-add"
          aria-label="Add book from Discover"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="library-shelf-slot-label" aria-hidden />
          <span className="library-shelf-add-inner">
            <span className="library-shelf-add-plus">+</span>
            <span className="library-shelf-add-label">ADD BOOK</span>
          </span>
          <span className="library-shelf-card-title library-shelf-add-caption">
            Discover
          </span>
        </Link>
      </div>
    </div>
  );
}
