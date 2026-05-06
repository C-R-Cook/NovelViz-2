"use client";

import { BookRequestModal } from "@/components/book-request-modal";
import type { DiscoverCatalogueBook } from "@/lib/discover-catalogue";
import { GENRE_OPTIONS, formatGenre } from "@/lib/genre";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type ApiResponse = {
  books: DiscoverCatalogueBook[];
  nextCursor: string | null;
};

type Props = {
  featured: DiscoverCatalogueBook[];
  allBooks: DiscoverCatalogueBook[];
};

const GENRE_PILLS = [{ value: "all", label: "All" }, ...GENRE_OPTIONS];

function buildQuery(input: {
  genre: string;
  cursor: string | null;
  search?: string;
  limit?: number;
}): string {
  const p = new URLSearchParams();
  if (input.genre !== "all") p.set("genre", input.genre);
  if (input.cursor) p.set("cursor", input.cursor);
  if (input.search?.trim()) p.set("search", input.search.trim());
  if (input.limit) p.set("limit", String(input.limit));
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
  activeIndex: number;
  isLast: boolean;
  finePointer: boolean;
  reducedMotion: boolean;
};

const CAROUSEL_CARD_OVERLAY_GRADIENT =
  "absolute inset-0 bg-gradient-to-t from-bg-overlay/90 via-bg-overlay/35 to-transparent";
const CAROUSEL_CARD_TEXT_WRAP = "absolute inset-x-0 bottom-0 p-3";
const CAROUSEL_CARD_TITLE = "line-clamp-1 text-sm font-semibold text-text-primary";
const CAROUSEL_CARD_AUTHOR = "mt-1 line-clamp-1 text-xs text-text-secondary";

function zIndexFromDistance(distance: number): number {
  if (distance === 0) return 50;
  if (distance === 1) return 40;
  if (distance === 2) return 30;
  return 20;
}

function computeDepthStyle(
  index: number,
  activeIndex: number,
  variant: "featured" | "browse",
): CSSProperties {
  const offset = index - activeIndex;
  const direction = offset < 0 ? 1 : -1;
  const distance = Math.abs(offset);

  const featured = {
    adjacentScale: 0.85,
    adjacentRotate: 12,
    adjacentOpacity: 0.85,
    outerScale: 0.7,
    outerRotate: 20,
    outerOpacity: 0.7,
  };
  const browse = {
    adjacentScale: 0.88,
    adjacentRotate: 8,
    adjacentOpacity: 0.88,
    outerScale: 0.76,
    outerRotate: 14,
    outerOpacity: 0.76,
  };
  const d = variant === "featured" ? featured : browse;

  if (distance === 0) {
    return {
      transform: "scale(1) rotateY(0deg)",
      opacity: 1,
      filter: "brightness(1)",
      transition: "transform 300ms ease, opacity 300ms ease, filter 300ms ease",
      transformStyle: "preserve-3d",
      position: "relative",
    };
  }

  const isAdjacent = distance === 1;
  const scale = isAdjacent ? d.adjacentScale : d.outerScale;
  const rotate = direction * (isAdjacent ? d.adjacentRotate : d.outerRotate);
  const opacity = isAdjacent ? d.adjacentOpacity : d.outerOpacity;

  return {
    transform: `scale(${scale}) rotateY(${rotate}deg)`,
    opacity,
    filter: `brightness(${Math.max(0.78, opacity + 0.05)})`,
    transition: "transform 300ms ease, opacity 300ms ease, filter 300ms ease",
    transformStyle: "preserve-3d",
    position: "relative",
  };
}

function FeaturedCarouselCard({
  book,
  index,
  activeIndex,
  isLast,
  finePointer,
  reducedMotion,
}: FeaturedCarouselCardProps) {
  const depthStyle = computeDepthStyle(index, activeIndex, "featured");
  const distanceFeatured = Math.abs(index - activeIndex);

  return (
    <span
      className={`relative snap-center shrink-0 inline-block ${!isLast ? "mr-[-26px]" : ""} ${!reducedMotion ? "discover-animate-in" : ""}`}
      style={{
        zIndex: zIndexFromDistance(distanceFeatured),
        position: "relative",
        ...(!reducedMotion ? { animationDelay: `${index * 50}ms` } : {}),
      }}
    >
      <Link
        href={`/discover/${book.id}`}
        data-carousel-card
        className="group block cursor-pointer outline-none"
      >
        <div
          className={`relative w-[180px] overflow-hidden rounded-xl border border-border bg-bg-base shadow-sm transition-all duration-200 ease-out ${
            finePointer
              ? "hover:scale-[1.03] hover:shadow-lg hover:shadow-bg-overlay/45 focus-visible:scale-[1.03] focus-visible:shadow-lg"
              : "active:scale-[0.99]"
          }`}
          style={depthStyle}
        >
          <div className="relative aspect-[2/3] w-full">
            <Image src={book.coverImageUrl} alt={book.title} fill className="object-cover" sizes="180px" priority={index < 2} />
            <div className="absolute right-2 top-2 rounded-full border border-border/70 bg-bg-overlay/65 px-2 py-0.5 text-[10px] font-medium text-text-primary backdrop-blur-sm">
              {book.genre ? formatGenre(book.genre) : "Unknown"}
            </div>
            <div className={CAROUSEL_CARD_OVERLAY_GRADIENT} />
            <div className={CAROUSEL_CARD_TEXT_WRAP}>
              <p className={CAROUSEL_CARD_TITLE}>{book.title}</p>
              <p className={CAROUSEL_CARD_AUTHOR}>{book.author}</p>
            </div>
          </div>
        </div>
      </Link>
    </span>
  );
}

export function DiscoverCatalogueClient({
  featured,
  allBooks,
}: Props) {
  const { finePointer, reducedMotion } = useDiscoverMotionPrefs();
  const [genre, setGenre] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [expandedBooks, setExpandedBooks] = useState<DiscoverCatalogueBook[]>([]);
  const [expandedNextCursor, setExpandedNextCursor] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [bookRequestOpen, setBookRequestOpen] = useState(false);

  const fetchSeq = useRef(0);
  const featuredScrollerRef = useRef<HTMLDivElement>(null);
  const browseScrollerRef = useRef<HTMLDivElement>(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [activeBrowse, setActiveBrowse] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const findActiveCardIndex = useCallback((container: HTMLDivElement | null) => {
    if (!container) return 0;
    const nodes = container.querySelectorAll<HTMLElement>("[data-carousel-card]");
    if (nodes.length === 0) return 0;
    const rootRect = container.getBoundingClientRect();
    const mid = rootRect.left + rootRect.width / 2;
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    nodes.forEach((node, i) => {
      const r = node.getBoundingClientRect();
      const c = r.left + r.width / 2;
      const d = Math.abs(c - mid);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    return bestIndex;
  }, []);

  const updateActiveFeatured = useCallback(() => {
    setActiveFeatured(findActiveCardIndex(featuredScrollerRef.current));
  }, [findActiveCardIndex]);

  const updateActiveBrowse = useCallback(() => {
    setActiveBrowse(findActiveCardIndex(browseScrollerRef.current));
  }, [findActiveCardIndex]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const browseSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const searchQuery = debouncedSearch.trim().toLowerCase();
  const searchActive = searchQuery.length > 0;

  const genrePills = useMemo(() => {
    const seen = new Set<string>();
    for (const book of allBooks) {
      if (book.genre) seen.add(book.genre);
    }
    return GENRE_PILLS.filter((pill) => pill.value === "all" || seen.has(pill.value));
  }, [allBooks]);

  const filteredByGenre = useMemo(() => {
    if (genre === "all") return allBooks;
    return allBooks.filter((book) => book.genre === genre);
  }, [allBooks, genre]);

  const browseBooks = useMemo(() => filteredByGenre.slice(0, 20), [filteredByGenre]);

  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    return allBooks.filter((book) => {
      const title = book.title.toLowerCase();
      const author = book.author.toLowerCase();
      return title.includes(searchQuery) || author.includes(searchQuery);
    });
  }, [allBooks, searchActive, searchQuery]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const loadExpandedFirstPage = useCallback(async (g: string) => {
    const seq = ++fetchSeq.current;
    setExpandedLoading(true);
    setExpandedError(null);
    setExpandedBooks([]);
    setExpandedNextCursor(null);
    try {
      const res = await fetch(
        `/api/books${buildQuery({ genre: g, cursor: null, limit: 20 })}`,
      );
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        if (seq === fetchSeq.current) {
          setExpandedError(data.error ?? "Could not load books");
        }
        return;
      }
      if (seq !== fetchSeq.current) return;
      setExpandedBooks(data.books);
      setExpandedNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor;
    } catch {
      if (seq === fetchSeq.current) setExpandedError("Could not load books");
    } finally {
      if (seq === fetchSeq.current) setExpandedLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const cur = nextCursorRef.current;
    if (!cur || loadingMoreRef.current) return;
    const g = genre;
    const seq = fetchSeq.current;
    setLoadingMore(true);
    setExpandedError(null);
    try {
      const res = await fetch(
        `/api/books${buildQuery({ genre: g, cursor: cur, limit: 20 })}`,
      );
      const data = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        if (seq === fetchSeq.current) setExpandedError(data.error ?? "Could not load more");
        return;
      }
      if (seq !== fetchSeq.current) return;
      setExpandedBooks((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const add = data.books.filter((b) => !seen.has(b.id));
        return [...prev, ...add];
      });
      setExpandedNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor;
    } catch {
      if (seq === fetchSeq.current) setExpandedError("Could not load more");
    } finally {
      if (seq === fetchSeq.current) setLoadingMore(false);
    }
  }, [genre]);

  useEffect(() => {
    if (!expanded || searchActive || expandedLoading || expandedBooks.length === 0) return;
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
  }, [loadMore, expanded, searchActive, expandedLoading, expandedBooks.length]);

  function selectGenre(g: string) {
    if (g === genre) return;
    setGenre(g);
    setExpanded(false);
    setExpandedBooks([]);
    setExpandedNextCursor(null);
    nextCursorRef.current = null;
  }

  function toggleExpanded() {
    if (expanded) {
      setExpanded(false);
      browseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setExpanded(true);
    if (expandedBooks.length === 0 && !expandedLoading) {
      void loadExpandedFirstPage(genre);
    }
  }

  function updateBrowseScrollState() {
    const el = browseScrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < max - 2);
  }

  useEffect(() => {
    updateBrowseScrollState();
    updateActiveBrowse();
    const el = browseScrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      updateBrowseScrollState();
      updateActiveBrowse();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [browseBooks.length, genre, updateActiveBrowse]);

  useEffect(() => {
    updateActiveFeatured();
    const el = featuredScrollerRef.current;
    if (!el) return;
    const onScroll = () => updateActiveFeatured();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [featured.length, updateActiveFeatured]);

  function scrollBrowse(dir: -1 | 1) {
    const el = browseScrollerRef.current;
    if (!el) return;
    const card = el.querySelector("[data-book-card]") as HTMLElement | null;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(el).gap || "0");
    const step = card.getBoundingClientRect().width + gap;
    el.scrollBy({ left: dir * step * 3, behavior: "smooth" });
  }

  const showFeatured = featured.length > 0;
  const centerFeaturedRow = featured.length <= 5;
  const genreEnterDelayMs = showFeatured ? featured.length * 50 + 280 : 100;

  const selectedGenreName = genrePills.find((pill) => pill.value === genre)?.label ?? "All";

  function BookCard({
    book,
    size,
    index,
    activeIndex,
    isLast,
  }: {
    book: DiscoverCatalogueBook;
    size: "carousel" | "grid";
    index?: number;
    activeIndex?: number;
    isLast?: boolean;
  }) {
    const cardClass =
      size === "carousel"
        ? "w-[160px] min-w-[160px]"
        : "w-full";
    const carouselDepthStyle =
      size === "carousel" && typeof index === "number" && typeof activeIndex === "number"
        ? computeDepthStyle(index, activeIndex, "browse")
        : undefined;
    const distanceBrowse =
      size === "carousel" && typeof index === "number" && typeof activeIndex === "number"
        ? Math.abs(index - activeIndex)
        : 0;
    return (
      <Link
        href={`/books/${book.id}`}
        data-carousel-card={size === "carousel" ? "true" : undefined}
        className={`group block outline-none ${size === "grid" ? "w-full" : ""} ${size === "carousel" ? "relative" : ""} ${size === "carousel" && !isLast ? "mr-[-20px]" : ""}`}
        style={
          size === "carousel"
            ? { position: "relative", zIndex: zIndexFromDistance(distanceBrowse) }
            : undefined
        }
      >
        <article
          data-book-card
          className={`${cardClass} relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-bg-base shadow-sm transition-all duration-200 ease-out ${finePointer ? "hover:scale-[1.03] hover:shadow-lg hover:shadow-bg-overlay/45 focus-visible:scale-[1.03] focus-visible:shadow-lg" : "active:scale-[0.99]"}`}
          style={carouselDepthStyle}
        >
          {book.coverImageUrl ? (
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              className="object-cover"
              sizes={
                size === "carousel"
                  ? "160px"
                  : "(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
              }
            />
          ) : (
            <div className="absolute inset-0 bg-bg-raised" />
          )}

          <div className="absolute right-2 top-2 rounded-full border border-border/70 bg-bg-overlay/65 px-2 py-0.5 text-[10px] font-medium text-text-primary backdrop-blur-sm">
            {book.genre ? formatGenre(book.genre) : "Unknown"}
          </div>

          <div className={CAROUSEL_CARD_OVERLAY_GRADIENT} />
          <div className={CAROUSEL_CARD_TEXT_WRAP}>
            <p className={CAROUSEL_CARD_TITLE}>{book.title}</p>
            <p className={CAROUSEL_CARD_AUTHOR}>{book.author}</p>
          </div>

          <div
            className={`absolute inset-0 flex items-center justify-center bg-bg-overlay/45 transition-opacity duration-200 ease-out ${finePointer ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}
          >
            <span className="rounded-md bg-bg-surface/85 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-primary">
              View Book
            </span>
          </div>
        </article>
      </Link>
    );
  }

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

        <section className="mb-10">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or author..."
              className="w-full rounded-xl border border-border bg-bg-surface px-10 py-3 text-sm text-text-primary outline-none transition duration-200 ease-out placeholder:text-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-text-muted transition hover:bg-bg-raised hover:text-text-primary"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        </section>

        {!searchActive && showFeatured ? (
          <section className="mb-14 sm:mb-16">
            <h2 className="mb-5 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
              Featured
            </h2>
            <div>
              <div
                ref={featuredScrollerRef}
                className={`-mx-4 relative flex gap-0 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-pb-4 sm:mx-0 sm:px-0 ${
                  centerFeaturedRow ? "sm:justify-center" : ""
                }`}
                style={{ perspective: "1000px", transformStyle: "preserve-3d", position: "relative" }}
              >
                {featured.map((book, i) => (
                  <FeaturedCarouselCard
                    key={book.id}
                    book={book}
                    index={i}
                    activeIndex={activeFeatured}
                    isLast={i === featured.length - 1}
                    finePointer={finePointer}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!searchActive ? (
          <section className="mb-8">
          <h2 className="sr-only">Filter by genre</h2>
          <div
            className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              !reducedMotion ? "discover-animate-in" : ""
            }`}
            style={!reducedMotion ? { animationDelay: `${genreEnterDelayMs}ms` } : undefined}
          >
            {genrePills.map((pill) => {
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
                      ? `bg-accent text-text-inverse ${!reducedMotion ? "discover-pill-pulse" : ""}`
                      : "border border-border bg-bg-raised text-text-secondary hover:bg-bg-raised hover:text-text-primary"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
          </section>
        ) : null}

        {searchActive ? (
          <section className="mb-12">
            <div className="mb-4 text-sm text-text-secondary">
              {searchResults.length} results for &quot;{debouncedSearch.trim()}&quot;
            </div>
            {searchResults.length === 0 ? (
              <p className="rounded-lg border border-border bg-bg-surface p-4 text-sm text-text-secondary">
                No books found for &quot;{debouncedSearch.trim()}&quot;
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((book) => (
                  <BookCard key={book.id} book={book} size="grid" />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section ref={browseSectionRef} className="mb-8">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">
                    Browse {selectedGenreName} Books
                  </h2>
                </div>
                {filteredByGenre.length > 20 ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="text-sm font-medium text-accent-text transition duration-200 hover:underline underline-offset-2"
                  >
                    {expanded ? "Show Less ↑" : "View All →"}
                  </button>
                ) : null}
              </div>

              <div className="relative">
                <div
                  ref={browseScrollerRef}
                  className="relative flex gap-0 overflow-x-auto pb-2 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{
                    perspective: "1000px",
                    transformStyle: "preserve-3d",
                    position: "relative",
                  }}
                >
                  {browseBooks.map((book, i) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      size="carousel"
                      index={i}
                      activeIndex={activeBrowse}
                      isLast={i === browseBooks.length - 1}
                    />
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center md:flex">
                  {canScrollLeft ? (
                    <button
                      type="button"
                      className="pointer-events-auto ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface/80 text-text-primary transition duration-200 ease-out hover:bg-bg-raised"
                      onClick={() => scrollBrowse(-1)}
                      aria-label="Scroll left"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center justify-end md:flex">
                  {canScrollRight ? (
                    <button
                      type="button"
                      className="pointer-events-auto mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface/80 text-text-primary transition duration-200 ease-out hover:bg-bg-raised"
                      onClick={() => scrollBrowse(1)}
                      aria-label="Scroll right"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                expanded ? "max-h-[300rem] opacity-100" : "max-h-0 opacity-0"
              }`}
              aria-hidden={!expanded}
            >
              {expanded ? (
                <>
                  {expandedError ? (
                    <p className="mb-4 text-sm text-error/90">{expandedError}</p>
                  ) : null}

                  {expandedLoading ? (
                    <div className="mb-8 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {expandedBooks.map((book) => (
                        <BookCard key={book.id} book={book} size="grid" />
                      ))}
                    </div>
                  )}

                  <div ref={sentinelRef} className="h-4 w-full" />
                  <div className="mt-4 mb-8 flex min-h-[2.5rem] flex-col items-center justify-center gap-2">
                    {loadingMore ? (
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
                    ) : null}
                    {!expandedNextCursor && expandedBooks.length > 0 && !loadingMore && !expandedLoading ? (
                      <p className="text-xs text-text-muted">No more books</p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          </>
        )}

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
