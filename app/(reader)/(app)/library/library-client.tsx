"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LibraryActiveBookBar } from "./library-active-book-bar";
import { LibraryBookPanel } from "./library-book-panel";
import { LibraryStickyHeader } from "./library-sticky-header";
import { LibraryShelf } from "./library-shelf";
import { useLibraryChapterProgress } from "./use-library-chapter-progress";
import type { LibraryBookRow, LibraryTotals } from "./library-types";
import "./library-redesign.css";

export type { LibraryBookRow, LibraryTotals } from "./library-types";

/** Matches reader main padding-top: min-h-14 nav + small gap */
const NAV_OFFSET_PX = 60;
/** Matches --library-sticky-head-h in library-redesign.css */
const STICKY_HEAD_HEIGHT_PX = 44;
const IMAGES_STICKY_TOP_PX = NAV_OFFSET_PX + STICKY_HEAD_HEIGHT_PX * 2;

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

type Props = {
  books: LibraryBookRow[];
  totals: LibraryTotals;
  defaultActiveBookId: string;
  viewerRole: "reader" | "partner" | "admin";
  initialTab?: "ask" | "imagine";
  initialQuestion?: string;
};

type PanelPhase = "visible" | "out" | "in";

export function LibraryClient({
  books,
  totals,
  defaultActiveBookId,
  viewerRole,
  initialTab,
  initialQuestion,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const finePointer = useFinePointer();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [activeBookId, setActiveBookId] = useState(defaultActiveBookId);
  const [headerIn, setHeaderIn] = useState(false);
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("visible");
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);

  useEffect(() => {
    setActiveBookId(defaultActiveBookId);
  }, [defaultActiveBookId]);

  useEffect(() => {
    const t = window.setTimeout(() => setHeaderIn(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const activeBook = useMemo(
    () => books.find((b) => b.bookId === activeBookId) ?? books[0] ?? null,
    [books, activeBookId],
  );

  const chapterProgress = useLibraryChapterProgress(
    activeBook,
    activeBook?.progress ?? null,
  );

  const selectBook = useCallback(
    (bookId: string) => {
      if (bookId === activeBookId) return;
      if (reducedMotion) {
        setActiveBookId(bookId);
        router.replace(`/library?book=${encodeURIComponent(bookId)}`, { scroll: false });
        return;
      }
      setPendingBookId(bookId);
      setPanelPhase("out");
    },
    [activeBookId, reducedMotion, router],
  );

  useEffect(() => {
    if (panelPhase !== "out" || !pendingBookId) return;
    const t = window.setTimeout(() => {
      setActiveBookId(pendingBookId);
      router.replace(`/library?book=${encodeURIComponent(pendingBookId)}`, { scroll: false });
      setPendingBookId(null);
      setPanelPhase("in");
    }, 150);
    return () => window.clearTimeout(t);
  }, [panelPhase, pendingBookId, router]);

  useEffect(() => {
    if (panelPhase !== "in") return;
    const t = window.setTimeout(() => setPanelPhase("visible"), 200);
    return () => window.clearTimeout(t);
  }, [panelPhase, activeBookId]);

  const tabFromUrl = searchParams.get("tab");
  const qFromUrl = searchParams.get("q");
  const deepTab =
    tabFromUrl === "ask" || tabFromUrl === "imagine" ? tabFromUrl : initialTab;
  const deepQuestion = qFromUrl ?? initialQuestion;

  const readingAnchorRef = useRef<HTMLDivElement>(null);
  const shelfAnchorRef = useRef<HTMLDivElement>(null);
  const imagesAnchorRef = useRef<HTMLDivElement>(null);

  const onReadingAnchorRef = useCallback((node: HTMLDivElement | null) => {
    readingAnchorRef.current = node;
  }, []);
  const onShelfAnchorRef = useCallback((node: HTMLDivElement | null) => {
    shelfAnchorRef.current = node;
  }, []);
  const onImagesAnchorRef = useCallback((node: HTMLDivElement | null) => {
    imagesAnchorRef.current = node;
  }, []);

  const scrollToReading = useCallback(() => {
    readingAnchorRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reducedMotion]);

  const scrollToShelf = useCallback(() => {
    shelfAnchorRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reducedMotion]);

  const scrollToImages = useCallback(() => {
    imagesAnchorRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reducedMotion]);

  if (books.length === 0) {
    return (
      <div className="library-root">
        <div className="library-root-inner">
          <header className={`library-page-header ${headerIn ? "library-page-header--in" : ""}`}>
            <h1 className="library-page-title">My Library</h1>
          </header>
          <div className="library-empty mt-10 text-center">
            <p className="text-sm text-text-secondary">Your library is empty.</p>
            <Link
              href="/discover"
              className="mt-4 inline-flex rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent/20"
            >
              Browse Discover
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-root">
      <div className="library-root-inner">
        <header className={`library-page-header ${headerIn ? "library-page-header--in" : ""}`}>
          <h1 className="library-page-title">My Library</h1>
        </header>

        {activeBook ? (
          <LibraryBookPanel
            key={activeBook.bookId}
            book={activeBook}
            chapterNumber={chapterProgress.chapterNumber}
            viewerRole={viewerRole}
            initialTab={deepTab}
            initialQuestion={deepQuestion ?? undefined}
          >
            {({ ai, images }) => (
              <div
                className={`library-active-zone library-panel--${panelPhase}`}
                style={{ ["--library-nav-offset" as string]: `${NAV_OFFSET_PX}px` }}
              >
                <div className="library-scroll-sections">
                  <LibraryStickyHeader
                    anchorRef={onReadingAnchorRef}
                    scrollAnchorClassName="library-scroll-anchor--reading"
                    variant="reading"
                    title="Currently reading"
                    stickyTop={NAV_OFFSET_PX}
                    onTitleClick={scrollToReading}
                  />
                  <div className="library-section-content library-section-content--reading">
                    <div className="library-reading-wrap library-reading-split">
                      <div className="library-reading-col-book">
                        <LibraryActiveBookBar
                          book={activeBook}
                          chapters={chapterProgress.chapters}
                          progress={{
                            selectedChapterId: chapterProgress.selectedChapterId,
                            selectChapter: chapterProgress.selectChapter,
                            saving: chapterProgress.saving,
                            message: chapterProgress.message,
                            chapterNumber: chapterProgress.chapterNumber,
                            progressPercent: chapterProgress.progressPercent,
                            total: chapterProgress.total,
                            isNotStarted: chapterProgress.isNotStarted,
                          }}
                        />
                      </div>
                      <div className="library-reading-col-ai">{ai}</div>
                    </div>
                  </div>
                  <LibraryStickyHeader
                    anchorRef={onShelfAnchorRef}
                    scrollAnchorClassName="library-scroll-anchor--shelf"
                    variant="shelf"
                    title="My Book Shelf"
                    stickyTop={NAV_OFFSET_PX + STICKY_HEAD_HEIGHT_PX}
                    onTitleClick={scrollToShelf}
                  />
                  <div className="library-section-content library-section-content--shelf">
                    <div className="library-shelf-wrap">
                      <LibraryShelf
                        books={books}
                        activeBookId={activeBookId}
                        onSelectBook={selectBook}
                        reducedMotion={reducedMotion}
                        finePointer={finePointer}
                      />
                    </div>
                  </div>
                  {images ? (
                    <>
                      <LibraryStickyHeader
                        anchorRef={onImagesAnchorRef}
                        scrollAnchorClassName="library-scroll-anchor--images"
                        variant="images"
                        title={images.title}
                        stickyTop={IMAGES_STICKY_TOP_PX}
                        headChildren={images.headExtra}
                        onTitleClick={scrollToImages}
                      />
                      <div className="library-section-content library-section-content--images">
                        {images.content}
                      </div>
                      <div className="library-scroll-tail" aria-hidden />
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </LibraryBookPanel>
        ) : (
          <div
            className="library-scroll-sections"
            style={{ ["--library-nav-offset" as string]: `${NAV_OFFSET_PX}px` }}
          >
            <LibraryStickyHeader
              anchorRef={onShelfAnchorRef}
              scrollAnchorClassName="library-scroll-anchor--shelf"
              variant="shelf-solo"
              title="My Book Shelf"
              stickyTop={NAV_OFFSET_PX}
              onTitleClick={scrollToShelf}
            />
            <div className="library-section-content library-section-content--shelf">
              <div className="library-shelf-wrap">
                <LibraryShelf
                  books={books}
                  activeBookId={activeBookId}
                  onSelectBook={selectBook}
                  reducedMotion={reducedMotion}
                  finePointer={finePointer}
                />
              </div>
            </div>
          </div>
        )}

        <section className="library-stats" aria-label="Library statistics">
          <div
            className="library-stat-card library-stat-card--delay-0"
            style={{ animationDelay: reducedMotion ? "0ms" : "600ms" }}
          >
            <p className="library-stat-label">Books in Library</p>
            <p className="library-stat-value">{totals.books}</p>
          </div>
          <div
            className="library-stat-card library-stat-card--delay-1"
            style={{ animationDelay: reducedMotion ? "0ms" : "680ms" }}
          >
            <p className="library-stat-label">Total Questions Asked</p>
            <p className="library-stat-value">{totals.queries}</p>
          </div>
          <div
            className="library-stat-card library-stat-card--delay-2"
            style={{ animationDelay: reducedMotion ? "0ms" : "760ms" }}
          >
            <p className="library-stat-label">Total Images Created</p>
            <p className="library-stat-value">{totals.images}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
