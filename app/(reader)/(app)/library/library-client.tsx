"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LibraryContextPanel } from "./library-context-panel";
import { LibraryOpenBook } from "./library-open-book";
import type { LibraryBookRow, LibraryTotals } from "./library-types";
import "./library-redesign.css";

export type { LibraryBookRow, LibraryTotals } from "./library-types";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function useFinePointer() {
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const mqFine = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mqFine.matches);
    sync();
    mqFine.addEventListener("change", sync);
    return () => mqFine.removeEventListener("change", sync);
  }, []);
  return finePointer;
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

function ShelfCoverImage({ src, title }: { src: string; title: string }) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center px-2 text-center font-serif text-[11px] leading-tight text-text-primary"
        style={{
          background: "color-mix(in srgb, var(--accent) 32%, var(--bg-surface))",
        }}
      >
        {title}
      </div>
    );
  }
  return (
    <Image src={src} alt={title} fill className="object-contain" sizes="130px" onError={() => setBad(true)} />
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

type Props = {
  books: LibraryBookRow[];
  totals: LibraryTotals;
  defaultActiveBookId: string;
};

export function LibraryClient({ books, totals, defaultActiveBookId }: Props) {
  const router = useRouter();
  const finePointer = useFinePointer();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [activeBookId, setActiveBookId] = useState(defaultActiveBookId);
  /** Start open when the shelf has books so the hero is not stuck closed before the first effect frame. */
  const [bookOpen, setBookOpen] = useState(() => books.length > 0);
  const [panelVisible, setPanelVisible] = useState(false);
  const [headerIn, setHeaderIn] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const bookIdSet = useMemo(() => new Set(books.map((b) => b.bookId)), [books]);
  const effectiveActiveBookId =
    activeBookId && bookIdSet.has(activeBookId) ? activeBookId : (books[0]?.bookId ?? "");

  useEffect(() => {
    if (books.length === 0) {
      setBookOpen(false);
      return;
    }
    setBookOpen(true);
    const t1 = setTimeout(() => setHeaderIn(true), 80);
    return () => {
      clearTimeout(t1);
    };
  }, [books.length]);

  const activeBook = useMemo(
    () => books.find((b) => b.bookId === effectiveActiveBookId) ?? books[0] ?? null,
    [books, effectiveActiveBookId],
  );

  const handleAnimationComplete = useCallback(() => {
    setPanelVisible(true);
  }, []);

  const handleBookSelect = useCallback((id: string) => {
    if (id === effectiveActiveBookId) return;
    setActiveBookId(id);
  }, [effectiveActiveBookId]);

  const removeFromLibrary = useCallback(
    async (bookId: string) => {
      if (!window.confirm("Remove this book from your library?")) return;
      const res = await fetch(`/api/library/${bookId}`, { method: "DELETE" });
      if (!res.ok) return;
      router.refresh();
    },
    [router],
  );

  const n = totals.books;

  return (
    <div className="library-root pb-20 pt-6 text-text-primary sm:pt-10">
      <div className="library-root-inner">
        <header className="library-header">
          <div>
            <div className={`library-eyebrow ${headerIn ? "library-header-in" : ""}`}>Your collection</div>
            <div className={`library-title-wrap ${headerIn ? "library-header-in" : ""}`}>
              <h1 className="library-title">My Library</h1>
            </div>
          </div>
          <Link href="/books" className={`library-add-btn ${headerIn ? "library-header-in" : ""}`}>
            + Add book
          </Link>
        </header>

        {n === 0 ? (
          <div className="library-empty">
            <EmptyLibraryIcon className="mx-auto h-14 w-14 text-text-muted" />
            <p className="library-empty-title">Your library is empty</p>
            <p className="mt-3 text-sm text-text-muted">Browse Discover to find your next book.</p>
            <Link href="/books" className="library-empty-link">
              Browse Discover
            </Link>
          </div>
        ) : activeBook ? (
          <>
            <section className="library-hero" aria-label="Featured book">
              <div className="library-hero-book">
                <LibraryOpenBook book={activeBook} isOpen={bookOpen} onAnimationComplete={handleAnimationComplete} />
              </div>
              <div className="library-context-col">
                <LibraryContextPanel book={activeBook} visible={panelVisible} />
              </div>
            </section>

            <section aria-labelledby="library-shelf-heading">
              <div className="library-section-label-row">
                <h2 id="library-shelf-heading" className="library-section-label">
                  Your bookshelf
                </h2>
                <div className="library-section-label-line" />
                <span className="library-section-label-meta">
                  {books.length} book{books.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="library-shelf-wrap">
                <div className="library-shelf-hairline" aria-hidden />
                <div className="library-shelf-shadow-line" aria-hidden />

                <div className="library-no-h-scrollbar library-shelf-row">
                  {books.map((book, index) => {
                    const isActive = book.bookId === effectiveActiveBookId;
                    const tilt = index % 2 === 0 ? -1.5 : 1.5;
                    const hovered = hoveredId === book.bookId;
                    const ch = book.progress?.currentChapterNumber ?? 1;
                    const total = Math.max(1, book.chapterTotal);
                    const pct = Math.round((ch / total) * 100);

                    let transform: string;
                    if (isActive) {
                      transform = "translateY(-16px) rotate(0deg) scale(1)";
                    } else if (finePointer && hovered) {
                      transform = "translateY(-10px) rotate(0deg) scale(1.02)";
                    } else {
                      transform = reducedMotion
                        ? "translateY(0) rotate(0deg) scale(1)"
                        : `translateY(0) rotate(${tilt}deg) scale(1)`;
                    }

                    const w = isActive ? 130 : 100;
                    const h = isActive ? 175 : 148;

                    return (
                      <div
                        key={book.userBookId}
                        className="library-shelf-item-wrap"
                        style={{
                          width: w,
                          height: h,
                          zIndex: isActive ? 10 : hovered ? 5 : 1,
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className={`library-shelf-card ${isActive ? "library-shelf-card--active" : ""} ${
                            finePointer && hovered && !isActive ? "library-shelf-card--hover" : ""
                          } ${reducedMotion ? "library-shelf-card--reduced-motion" : ""} library-shelf-card-enter`}
                          style={{
                            width: "100%",
                            height: "100%",
                            transform,
                            animationDelay: reducedMotion ? "0ms" : `${400 + index * 90}ms`,
                          }}
                          onClick={() => handleBookSelect(book.bookId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleBookSelect(book.bookId);
                            }
                          }}
                          onMouseEnter={() => setHoveredId(book.bookId)}
                          onMouseLeave={() => setHoveredId(null)}
                          aria-pressed={isActive}
                          aria-label={`Select ${book.title}`}
                        >
                          <div className="library-shelf-card-inner">
                            {book.coverImageUrl ? (
                              <div className="library-shelf-card-cover">
                                <ShelfCoverImage src={book.coverImageUrl} title={book.title} />
                              </div>
                            ) : (
                              <div
                                className="library-shelf-card-cover absolute inset-0 flex items-center justify-center px-2 text-center font-serif text-[11px] leading-tight text-text-primary"
                                style={{
                                  background: "color-mix(in srgb, var(--accent) 32%, var(--bg-surface))",
                                }}
                              >
                                {book.title}
                              </div>
                            )}
                            <div className="library-shelf-card-overlay" aria-hidden />
                            <div className="library-shelf-card-bottom">
                              <div className="library-shelf-card-title-mini">{book.title}</div>
                              <div className="library-shelf-card-progress">
                                <div className="library-shelf-card-progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            {isActive ? (
                              <span className="library-shelf-gem" aria-hidden>
                                ✦
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="library-remove-fab"
                          aria-label={`Remove ${book.title} from library`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void removeFromLibrary(book.bookId);
                          }}
                        >
                          <RemoveFromLibraryIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <Link href="/books" className="library-shelf-add" style={{ width: 100, height: 148 }}>
                    <span className="library-shelf-add-icon">+</span>
                    <span className="library-shelf-add-label">Add book</span>
                  </Link>
                </div>

                <div className="library-no-h-scrollbar library-shelf-titles">
                  {books.map((book) => {
                    const isActive = book.bookId === effectiveActiveBookId;
                    const w = isActive ? 130 : 100;
                    return (
                      <button
                        key={`t-${book.userBookId}`}
                        type="button"
                        className={`library-shelf-title-cell ${isActive ? "library-shelf-title-cell--active" : ""}`}
                        style={{ width: w }}
                        onClick={() => handleBookSelect(book.bookId)}
                      >
                        <div className="library-shelf-title-text">{book.title}</div>
                      </button>
                    );
                  })}
                  <div className="library-shelf-title-spacer" style={{ width: 100 }} aria-hidden />
                </div>
              </div>
            </section>

            <div className="library-stats-grid">
              <div className="library-stat-card" data-i="0">
                <div className="library-stat-label">Books in library</div>
                <div className="library-stat-value">{totals.books}</div>
              </div>
              <div className="library-stat-card" data-i="1">
                <div className="library-stat-label">Total questions asked</div>
                <div className="library-stat-value">{totals.queries}</div>
              </div>
              <div className="library-stat-card" data-i="2">
                <div className="library-stat-label">Total images created</div>
                <div className="library-stat-value">{totals.images}</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
