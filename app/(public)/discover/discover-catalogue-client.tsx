"use client";

import { BookRequestModal } from "@/components/book-request-modal";
import type { DiscoverCatalogueBook } from "@/lib/discover-catalogue";
import { GENRE_OPTIONS, formatGenre } from "@/lib/genre";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type ApiResponse = {
  books: DiscoverCatalogueBook[];
  nextCursor: string | null;
  pageSize: number;
};

type Props = {
  featured: DiscoverCatalogueBook[];
  initialBooks: DiscoverCatalogueBook[];
  initialNextCursor: string | null;
};

const GENRE_PILLS = [{ value: "all", label: "All" }, ...GENRE_OPTIONS];

function buildQuery(genre: string, cursor: string | null): string {
  const p = new URLSearchParams();
  if (genre !== "all") p.set("genre", genre);
  if (cursor) p.set("cursor", cursor);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function useDiscoverMotionPrefs() {
  const [finePointer, setFinePointer] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mqFine = window.matchMedia("(pointer: fine)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setFinePointer(mqFine.matches);
      setReducedMotion(mqReduce.matches);
    };
    sync();
    mqFine.addEventListener("change", sync);
    mqReduce.addEventListener("change", sync);
    return () => {
      mqFine.removeEventListener("change", sync);
      mqReduce.removeEventListener("change", sync);
    };
  }, []);

  return { finePointer, reducedMotion };
}

type FeaturedCarouselCardProps = {
  book: DiscoverCatalogueBook;
  index: number;
  activeFeatured: number;
  finePointer: boolean;
  reducedMotion: boolean;
};

function FeaturedCarouselCard({
  book,
  index,
  activeFeatured,
  finePointer,
  reducedMotion,
}: FeaturedCarouselCardProps) {
  const [hover, setHover] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const faceRef = useRef<HTMLDivElement>(null);

  const offset = index - activeFeatured;
  const scrollRotateY = offset === 0 ? 0 : offset < 0 ? 14 : -14;
  const z = offset === 0 ? 20 : 10 - Math.abs(offset);

  const baseScale = offset === 0 ? 1.02 : 0.88;
  let scale = baseScale;
  if (finePointer && hover) {
    scale = offset === 0 ? 1.05 : Math.min(0.98, baseScale + 0.1);
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!finePointer || !faceRef.current) return;
    const rect = faceRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -py * 9, ry: px * 11 });
    setGlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const onMouseLeave = () => {
    setHover(false);
    setTilt({ rx: 0, ry: 0 });
    setGlare({ x: 50, y: 50 });
  };

  const faceTransform =
    finePointer && hover
      ? `perspective(720px) rotateX(${tilt.rx}deg) rotateY(${scrollRotateY + tilt.ry * 0.35}deg)`
      : `perspective(720px) rotateY(${scrollRotateY}deg)`;

  return (
    <span
      className={`snap-center shrink-0 inline-block ${!reducedMotion ? "discover-animate-in" : ""}`}
      style={!reducedMotion ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <Link
        href={`/discover/${book.id}`}
        data-carousel-card
        onMouseEnter={() => finePointer && setHover(true)}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        className="group block cursor-pointer outline-none transition-[transform,opacity] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-accent/50"
        style={{
          transform: `translateZ(0) scale(${scale})`,
          zIndex: z,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          ref={faceRef}
          className="relative w-[9.5rem] overflow-hidden rounded-lg transition-transform duration-200 ease-out will-change-transform sm:w-[11.5rem] md:w-[12.5rem]"
          style={{ transform: faceTransform, transformStyle: "preserve-3d" }}
        >
          <div className="relative aspect-[2/3] w-full">
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              className="object-cover"
              sizes="200px"
              priority={index < 2}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-0 mix-blend-overlay transition-opacity duration-300 ease-out group-hover:opacity-100"
              style={{
                background: `radial-gradient(ellipse 85% 70% at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 35%, transparent 58%)`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-base via-bg-overlay/40 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-overlay/50 via-bg-overlay/25 to-transparent opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pt-10">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary drop-shadow-md">
                {book.title}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{book.author}</p>
              <div
                className={`mt-2 flex justify-center transition-all duration-300 ease-out ${
                  finePointer
                    ? "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    : "hidden"
                }`}
              >
                <span className="rounded-full bg-bg-overlay/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-primary ring-1 ring-text-primary/20 backdrop-blur-sm">
                  View book
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </span>
  );
}

export function DiscoverCatalogueClient({
  featured,
  initialBooks,
  initialNextCursor,
}: Props) {
  const { finePointer, reducedMotion } = useDiscoverMotionPrefs();
  const [genre, setGenre] = useState("all");
  const [books, setBooks] = useState(initialBooks);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [gridLoading, setGridLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookRequestOpen, setBookRequestOpen] = useState(false);

  const fetchSeq = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextCursorRef = useRef(initialNextCursor);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const updateActiveFeatured = useCallback(() => {
    const root = scrollerRef.current;
    if (!root || featured.length === 0) return;
    const rootRect = root.getBoundingClientRect();
    const mid = rootRect.left + rootRect.width / 2;
    let best = 0;
    let bestDist = Infinity;
    root.querySelectorAll<HTMLElement>("[data-carousel-card]").forEach((node, i) => {
      const r = node.getBoundingClientRect();
      const c = r.left + r.width / 2;
      const d = Math.abs(c - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActiveFeatured(best);
  }, [featured.length]);

  useLayoutEffect(() => {
    updateActiveFeatured();
  }, [featured, updateActiveFeatured]);

  useEffect(() => {
    const onResize = () => updateActiveFeatured();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateActiveFeatured]);

  const loadGenreFirstPage = useCallback(async (g: string) => {
    const seq = ++fetchSeq.current;
    setGridLoading(true);
    setLoadError(null);
    setBooks([]);
    setNextCursor(null);
    try {
      const res = await fetch(`/api/books${buildQuery(g, null)}`);
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        if (seq === fetchSeq.current) {
          setLoadError(data.error ?? "Could not load books");
        }
        return;
      }
      if (seq !== fetchSeq.current) return;
      setBooks(data.books);
      setNextCursor(data.nextCursor);
    } catch {
      if (seq === fetchSeq.current) setLoadError("Could not load books");
    } finally {
      if (seq === fetchSeq.current) setGridLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const cur = nextCursorRef.current;
    if (!cur || loadingMoreRef.current) return;
    const g = genre;
    const seq = fetchSeq.current;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/books${buildQuery(g, cur)}`);
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        if (seq === fetchSeq.current) setLoadError(data.error ?? "Could not load more");
        return;
      }
      if (seq !== fetchSeq.current) return;
      setBooks((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const add = data.books.filter((b) => !seen.has(b.id));
        return [...prev, ...add];
      });
      setNextCursor(data.nextCursor);
    } catch {
      if (seq === fetchSeq.current) setLoadError("Could not load more");
    } finally {
      if (seq === fetchSeq.current) setLoadingMore(false);
    }
  }, [genre]);

  useEffect(() => {
    if (gridLoading || books.length === 0) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (!nextCursorRef.current || loadingMoreRef.current) return;
        void loadMore();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, gridLoading, books.length]);

  function selectGenre(g: string) {
    if (g === genre) return;
    setGenre(g);
    void loadGenreFirstPage(g);
  }

  const showFeatured = featured.length > 0;
  const showEmpty = !gridLoading && books.length === 0;

  const genreEnterDelayMs = showFeatured ? featured.length * 50 + 280 : 100;

  const gridHoverClass = finePointer
    ? "hover:scale-[1.04] hover:shadow-xl hover:shadow-bg-overlay/55 focus-visible:scale-[1.04] focus-visible:shadow-xl"
    : "active:scale-[0.99]";

  return (
    <div className="min-h-screen bg-bg-base pb-20 pt-6 text-text-primary sm:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mb-10 sm:mb-12">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            Discover
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-muted">
            Browse published titles with covers. Add what you love to your library.
          </p>
        </header>

        {showFeatured ? (
          <section className="mb-14 sm:mb-16">
            <h2 className="mb-5 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              Featured
            </h2>
            <div
              className="relative [perspective:1400px]"
              style={{ perspectiveOrigin: "50% 50%" }}
            >
              <div
                ref={scrollerRef}
                onScroll={updateActiveFeatured}
                className="-mx-4 flex gap-5 overflow-x-auto px-[min(18vw,7rem)] py-6 [scrollbar-width:none] sm:gap-6 sm:px-[min(14vw,8rem)] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-pb-4"
              >
                {featured.map((book, i) => (
                  <FeaturedCarouselCard
                    key={book.id}
                    book={book}
                    index={i}
                    activeFeatured={activeFeatured}
                    finePointer={finePointer}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8">
          <h2 className="sr-only">Filter by genre</h2>
          <div
            className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              !reducedMotion ? "discover-animate-in" : ""
            }`}
            style={!reducedMotion ? { animationDelay: `${genreEnterDelayMs}ms` } : undefined}
          >
            {GENRE_PILLS.map((pill) => {
              const active = genre === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => selectGenre(pill.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium outline-none transition-all duration-200 ease-out sm:text-sm ${
                    finePointer ? "hover:scale-105 hover:brightness-110" : "active:brightness-125"
                  } ${
                    active
                      ? `bg-accent text-text-inverse ring-1 ring-accent/55 ${!reducedMotion ? "discover-pill-pulse" : ""}`
                      : "border border-border bg-bg-raised text-text-secondary ring-1 ring-border hover:bg-bg-raised hover:text-text-primary"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </section>

        {loadError ? (
          <p className="mb-6 text-center text-sm text-error/90">{loadError}</p>
        ) : null}

        <section aria-busy={gridLoading}>
          {gridLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div
                className="h-9 w-9 rounded-full border-2 border-border border-t-accent animate-spin"
                aria-label="Loading"
              />
            </div>
          ) : showEmpty ? (
            <div className="mx-auto max-w-md py-20 text-center">
              <p className="font-serif text-xl text-text-secondary">No books here</p>
              <p className="mt-3 text-sm text-text-muted">
                Nothing published with a cover matches this genre yet. Try another filter.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                {books.map((book, i) => (
                  <Link
                    key={book.id}
                    href={`/discover/${book.id}`}
                    className={`group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-md shadow-sm shadow-bg-overlay/20 outline-none transition-all duration-200 ease-out ${gridHoverClass} focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      !reducedMotion ? "discover-animate-in" : ""
                    }`}
                    style={!reducedMotion ? { animationDelay: `${i * 50}ms` } : undefined}
                  >
                    <Image
                      src={book.coverImageUrl}
                      alt={book.title}
                      fill
                      className={`object-cover transition-transform duration-200 ease-out ${
                        finePointer ? "group-hover:scale-[1.02]" : ""
                      }`}
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-overlay via-bg-overlay/30 to-transparent" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-overlay/60 via-bg-overlay/25 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" />
                    {book.genre ? (
                      <div className="absolute right-2 top-2 max-w-[55%] truncate rounded-full bg-bg-overlay/50 px-2 py-0.5 text-[10px] font-medium text-text-primary/90 backdrop-blur-sm">
                        {formatGenre(book.genre)}
                      </div>
                    ) : null}
                    <div
                      className={`pointer-events-none absolute inset-x-0 bottom-0 p-2.5 pt-10 transition-transform duration-200 ease-out sm:p-3 ${
                        finePointer ? "group-hover:-translate-y-1" : ""
                      }`}
                    >
                      <p className="line-clamp-2 text-xs font-bold leading-snug text-text-primary drop-shadow sm:text-sm">
                        {book.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-text-secondary sm:text-xs">
                        {book.author}
                      </p>
                      <div
                        className={`mt-1.5 transition-all duration-200 ease-out ${
                          finePointer
                            ? "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                            : "opacity-0"
                        }`}
                      >
                        <span className="inline-block rounded-md bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/40">
                          View book
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div ref={sentinelRef} className="h-4 w-full" aria-hidden />

              <div className="mt-8 flex min-h-[2.5rem] flex-col items-center justify-center gap-2">
                {loadingMore ? (
                  <div
                    className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin"
                    aria-label="Loading more"
                  />
                ) : null}
                {!nextCursor && books.length > 0 && !loadingMore ? (
                  <p className="text-center text-xs text-text-muted">No more books</p>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="mt-16 border-t border-border pt-12 sm:mt-20 sm:pt-16" aria-labelledby="book-request-cta">
          <h2 id="book-request-cta" className="font-serif text-xl font-semibold text-text-primary sm:text-2xl">
            Can&apos;t find your book?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-muted">
            Let us know what you&apos;d like to read and we&apos;ll work with publishers to make it happen.
          </p>
          <button
            type="button"
            className="mt-5 rounded-lg bg-accent-muted px-4 py-2.5 text-sm font-medium text-accent-text ring-1 ring-accent/45 transition hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={() => setBookRequestOpen(true)}
          >
            Request a Book
          </button>
        </section>
      </div>

      <BookRequestModal open={bookRequestOpen} onClose={() => setBookRequestOpen(false)} />
    </div>
  );
}
