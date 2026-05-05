"use client";

import { formatGenre } from "@/lib/genre";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type LibraryBookRow = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string;
  genre: string | null;
  coverImageUrl: string | null;
  chapterTotal: number;
  progress: { currentChapterNumber: number } | null;
  removedFromCatalogue: boolean;
};

type Props = {
  readingBooks: LibraryBookRow[];
  gridBooks: LibraryBookRow[];
  totalCount: number;
};

function useLibraryMotionPrefs() {
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mqFine = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mqFine.matches);
    sync();
    mqFine.addEventListener("change", sync);
    return () => mqFine.removeEventListener("change", sync);
  }, []);

  return { finePointer };
}

function RemoveFromLibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function EmptyLibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 014-1.219c1.216 0 2.348.284 3.354.794M18 18.708A8.963 8.963 0 0112 21a8.967 8.967 0 01-6-2.292M15 12.75V18m-3-5.25v5.25m-3-5.25v5.25"
      />
    </svg>
  );
}

function LibraryBookCard({
  book,
  finePointer,
  layout,
  showProgressLine,
  onRemoveRequest,
}: {
  book: LibraryBookRow;
  finePointer: boolean;
  layout: "carousel" | "grid";
  showProgressLine: boolean;
  onRemoveRequest: (bookId: string) => void;
}) {
  const gridHoverClass = finePointer
    ? "hover:scale-[1.04] hover:shadow-xl hover:shadow-bg-overlay/55 focus-visible:scale-[1.04] focus-visible:shadow-xl"
    : "active:scale-[0.99]";
  const hasProgress = book.progress !== null;
  const cta = hasProgress ? "Continue Reading" : "Start Reading";
  const widthClass = layout === "carousel" ? "w-[10.5rem] shrink-0 sm:w-[12rem]" : "";
  const totalLabel = book.chapterTotal > 0 ? String(book.chapterTotal) : "—";

  const onRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemoveRequest(book.bookId);
    },
    [book.bookId, onRemoveRequest],
  );

  return (
    <div className={`group relative ${widthClass}`}>
      <Link
        href={`/reader/${book.bookId}`}
        className={`group relative block aspect-[2/3] cursor-pointer overflow-hidden rounded-md shadow-sm shadow-bg-overlay/20 outline-none transition-all duration-200 ease-out ${gridHoverClass} focus-visible:ring-2 focus-visible:ring-accent/50 ${
          book.removedFromCatalogue ? "opacity-85" : ""
        }`}
      >
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt={book.title}
            fill
            className={`object-cover transition-transform duration-200 ease-out ${
              finePointer ? "group-hover:scale-[1.02]" : ""
            }`}
            sizes={
              layout === "carousel"
                ? "(max-width: 640px) 42vw, 12rem"
                : "(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-surface px-2 text-center text-xs text-text-muted">
            No cover
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-overlay via-bg-overlay/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-overlay/60 via-bg-overlay/25 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" />
        {book.genre ? (
          <div className="absolute right-2 top-2 z-10 max-w-[55%] truncate rounded-full bg-bg-overlay/50 px-2 py-0.5 text-[10px] font-medium text-text-primary/90 backdrop-blur-sm">
            {formatGenre(book.genre)}
          </div>
        ) : null}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2.5 pt-10 transition-transform duration-200 ease-out sm:p-3 ${
            finePointer ? "group-hover:-translate-y-1" : ""
          }`}
        >
          {showProgressLine && book.progress ? (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary drop-shadow">
              Chapter {book.progress.currentChapterNumber} of {totalLabel}
            </p>
          ) : null}
          <p className="line-clamp-2 text-xs font-bold leading-snug text-text-primary drop-shadow sm:text-sm">
            {book.title}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-text-secondary drop-shadow sm:text-xs">{book.author}</p>
          <div
            className={`mt-1.5 transition-all duration-200 ease-out ${
              finePointer
                ? "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                : "opacity-0"
            }`}
          >
            <span className="pointer-events-none inline-block rounded-md bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/40">
              {cta}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={`absolute bottom-2 left-2 z-20 rounded-md border border-border bg-bg-base/90 p-1.5 text-text-muted shadow-md backdrop-blur-sm transition hover:border-error/35 hover:text-error focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          finePointer
            ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
            : "pointer-events-auto opacity-80"
        }`}
        aria-label={`Remove ${book.title} from library`}
        onClick={onRemoveClick}
      >
        <RemoveFromLibraryIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function LibraryClient({ readingBooks, gridBooks, totalCount }: Props) {
  const router = useRouter();
  const { finePointer } = useLibraryMotionPrefs();

  const removeFromLibrary = useCallback(
    async (bookId: string) => {
      if (!window.confirm("Remove this book from your library?")) return;
      const res = await fetch(`/api/library/${bookId}`, { method: "DELETE" });
      if (!res.ok) return;
      router.refresh();
    },
    [router],
  );

  const n = totalCount;

  return (
    <div className="min-h-screen bg-bg-base pb-20 pt-6 text-text-primary sm:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mb-10 sm:mb-12">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">My Library</h1>
          <p className="mt-2 text-sm text-text-muted">Your personal bookshelf</p>
          <p className="mt-3 text-sm font-medium text-text-secondary">
            {n} book{n === 1 ? "" : "s"}
          </p>
        </header>

        {n === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            <EmptyLibraryIcon className="mx-auto h-14 w-14 text-text-muted" />
            <p className="mt-6 font-serif text-xl text-text-primary">Your library is empty</p>
            <p className="mt-3 text-sm text-text-muted">Browse Discover to find your next book.</p>
            <Link
              href="/books"
              className="mt-8 inline-flex rounded-lg bg-accent-muted px-4 py-2.5 text-sm font-medium text-accent-text ring-1 ring-accent/45 transition hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Browse Discover
            </Link>
          </div>
        ) : (
          <>
            {readingBooks.length > 0 ? (
              <section className="mb-12 sm:mb-14" aria-labelledby="library-reading-heading">
                <h2
                  id="library-reading-heading"
                  className="mb-4 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted"
                >
                  Currently Reading
                </h2>
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:thin] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
                  {readingBooks.map((book) => (
                    <LibraryBookCard
                      key={book.userBookId}
                      book={book}
                      finePointer={finePointer}
                      layout="carousel"
                      showProgressLine
                      onRemoveRequest={removeFromLibrary}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="library-all-heading">
              <h2
                id="library-all-heading"
                className="mb-4 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted"
              >
                All Books
              </h2>
              {gridBooks.length === 0 ? (
                <p className="px-1 text-sm text-text-muted">
                  Every book you&apos;re reading appears above. More titles you add will show here.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {gridBooks.map((book) => (
                    <LibraryBookCard
                      key={book.userBookId}
                      book={book}
                      finePointer={finePointer}
                      layout="grid"
                      showProgressLine={false}
                      onRemoveRequest={removeFromLibrary}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
