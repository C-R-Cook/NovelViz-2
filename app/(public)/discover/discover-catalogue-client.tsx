"use client";

import "./discover-redesign.css";

import { BookRequestModal } from "@/components/book-request-modal";
import { DiscoverParticleField } from "@/components/discover-particle-field";
import type { DiscoverCatalogueBook } from "@/lib/discover-catalogue";
import { DISCOVER_DEFAULT_PALETTE } from "@/lib/discover-genre-palette";
import { GENRE_OPTIONS, formatGenre } from "@/lib/genre";
import type { BookGenre } from "@db";
import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookLibraryActions } from "./book-library-actions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type ApiResponse = {
  books: DiscoverCatalogueBook[];
  nextCursor: string | null;
};

type Props = {
  featured: DiscoverCatalogueBook[];
  allBooks: DiscoverCatalogueBook[];
  featuredLibrary?: { bookId: string; inLibrary: boolean }[];
  isLoggedIn?: boolean;
};

type FeaturedImage = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  username: string;
  commentCount?: number;
};

type VisionImage = FeaturedImage & {
  bookId: string;
  bookTitle: string;
  bookGenre: BookGenre | null;
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

const CAROUSEL_CARD_OVERLAY_GRADIENT =
  "absolute inset-0 bg-gradient-to-t from-bg-overlay/90 via-bg-overlay/35 to-transparent";
const CAROUSEL_CARD_TEXT_WRAP = "absolute inset-x-0 bottom-0 p-3";
const CAROUSEL_CARD_TITLE = "line-clamp-1 text-sm font-semibold text-text-primary";
const CAROUSEL_CARD_AUTHOR = "mt-1 line-clamp-1 text-xs text-text-secondary";

/** Browse carousel card width (px) — keep in sync with `BookCard` `w-[160px]`. */
const BROWSE_CAROUSEL_CARD_W = 160;

function zIndexFromDistance(distance: number): number {
  if (distance === 0) return 50;
  if (distance === 1) return 40;
  if (distance === 2) return 30;
  return 20;
}

/** Featured shelf: tilt / lift / neighbour lean (fine pointer + motion only). */
function shelfFeaturedCardTransform({
  index,
  isSelected,
  hovered,
  finePointer,
  reducedMotion,
  shelfHoverIndex,
}: {
  index: number;
  isSelected: boolean;
  hovered: boolean;
  finePointer: boolean;
  reducedMotion: boolean;
  shelfHoverIndex: number | null;
}): string {
  if (reducedMotion) {
    if (isSelected) return "translateY(-18px) rotate(0deg) scale(1.05)";
    return "translateY(0) rotate(0deg) scale(1)";
  }
  if (!finePointer) {
    if (isSelected) return "translateY(-18px) rotate(0deg) scale(1.05)";
    return "translateY(0) rotate(0deg) scale(1)";
  }
  if (isSelected) return "translateY(-18px) rotate(0deg) scale(1.05)";
  if (hovered) return "translateY(-14px) rotate(0deg) scale(1.03)";
  const position = index + 1;
  let tilt = position % 2 === 1 ? -1.5 : 1.5;
  if (shelfHoverIndex !== null && Math.abs(index - shelfHoverIndex) === 1) {
    if (index < shelfHoverIndex) tilt = Math.min(2, tilt + 0.5);
    else tilt = Math.max(-2, tilt - 0.5);
  }
  return `translateY(0) rotate(${tilt}deg) scale(1)`;
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

function ShelfFeaturedCard({
  book,
  index,
  isSelected,
  reducedMotion,
  finePointer,
  shelfHoverIndex,
  onShelfHoverIndex,
  onSelect,
}: {
  book: DiscoverCatalogueBook;
  index: number;
  isSelected: boolean;
  reducedMotion: boolean;
  finePointer: boolean;
  shelfHoverIndex: number | null;
  onShelfHoverIndex: (i: number | null) => void;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const transform = shelfFeaturedCardTransform({
    index,
    isSelected,
    hovered,
    finePointer,
    reducedMotion,
    shelfHoverIndex,
  });

  const zIndex = isSelected ? 30 : hovered ? 20 : 1;

  return (
    <button
      type="button"
      data-featured-active={isSelected ? "true" : "false"}
      onClick={onSelect}
      onMouseEnter={() => {
        setHovered(true);
        onShelfHoverIndex(index);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onShelfHoverIndex(null);
      }}
      className={`discover-shelf-card shrink-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
        isSelected ? "discover-shelf-card--active" : ""
      } ${hovered && !isSelected && finePointer ? "discover-shelf-card--hover" : ""} ${reducedMotion ? "discover-shelf-card--reduced-motion" : ""} ${!reducedMotion ? "discover-shelf-card-enter" : ""}`}
      style={{
        ...(!reducedMotion ? { animationDelay: `${index * 50}ms` } : {}),
        transform,
        zIndex,
      }}
    >
      <div className="discover-shelf-card-inner relative aspect-[2/3] w-full overflow-hidden rounded">
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt=""
            fill
            className={`object-cover transition-transform duration-500 ease-out ${
              finePointer && !reducedMotion && hovered && !isSelected ? "scale-[1.06]" : "scale-100"
            }`}
            sizes="200px"
            priority={index < 2}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
            style={{ background: DISCOVER_DEFAULT_PALETTE.glow }}
          >
            <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
              {book.genre ? formatGenre(book.genre).toUpperCase() : "UNKNOWN"}
            </div>
            <div className="font-serif text-base leading-snug text-white">{book.title}</div>
          </div>
        )}
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent transition-opacity duration-300 ${
            hovered || isSelected ? "opacity-100" : "opacity-70"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ${
            hovered || isSelected ? "translate-y-0 opacity-100" : "translate-y-1 opacity-60"
          }`}
        >
          <div
            className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: DISCOVER_DEFAULT_PALETTE.accent }}
          >
            {book.genre ? formatGenre(book.genre).toUpperCase() : "UNKNOWN"}
          </div>
          <div className="line-clamp-2 font-serif text-[13px] font-bold leading-tight text-white">{book.title}</div>
        </div>
        {isSelected ? (
          <span
            className="discover-shelf-gem"
            style={{
              background: DISCOVER_DEFAULT_PALETTE.accent,
              boxShadow: `0 0 8px ${DISCOVER_DEFAULT_PALETTE.accent}`,
            }}
            aria-hidden
          >
            ✦
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function DiscoverCatalogueClient({
  featured,
  allBooks,
  featuredLibrary = [],
  isLoggedIn = false,
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
  const [selectedFeaturedIndex, setSelectedFeaturedIndex] = useState(0);
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

  const updateActiveBrowse = useCallback(() => {
    setActiveBrowse(findActiveCardIndex(browseScrollerRef.current));
  }, [findActiveCardIndex]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const browseSectionRef = useRef<HTMLElement>(null);
  const featuredNavBlockUntilRef = useRef(0);
  const featuredDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    scrollLeft0: number;
    moved: boolean;
  }>({ pointerId: null, startX: 0, scrollLeft0: 0, moved: false });
  const [featuredScrollerDragging, setFeaturedScrollerDragging] = useState(false);
  const [featuredShelfHoverIndex, setFeaturedShelfHoverIndex] = useState<number | null>(null);

  const [visionImages, setVisionImages] = useState<VisionImage[]>([]);
  const [visionsLoading, setVisionsLoading] = useState(false);

  const selectedBook = featured[selectedFeaturedIndex] ?? null;

  useEffect(() => {
    setSelectedFeaturedIndex((idx) =>
      featured.length === 0 ? 0 : Math.min(idx, featured.length - 1),
    );
  }, [featured]);

  useEffect(() => {
    if (!selectedBook) {
      setVisionImages([]);
      setVisionsLoading(false);
      return;
    }
    let cancelled = false;
    setVisionsLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/gallery/book/${selectedBook.id}?featured=true&limit=8`);
        if (!res.ok) {
          if (!cancelled) {
            setVisionImages([]);
            setVisionsLoading(false);
          }
          return;
        }
        const data = (await res.json()) as { images?: FeaturedImage[] };
        if (!cancelled) {
          setVisionImages(
            (data.images ?? []).map((img) => ({
              ...img,
              bookId: selectedBook.id,
              bookTitle: selectedBook.title,
              bookGenre: selectedBook.genre,
            })),
          );
          setVisionsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setVisionImages([]);
          setVisionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBook]);

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
      const genreLabel = formatGenre(book.genre).toLowerCase();
      const genreNormalized = (book.genre ?? "").toLowerCase().replace(/_/g, " ");
      return (
        title.includes(searchQuery) ||
        author.includes(searchQuery) ||
        genreLabel.includes(searchQuery) ||
        genreNormalized.includes(searchQuery)
      );
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

  const onFeaturedPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!finePointer || reducedMotion) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(".discover-shelf-card")) return;
      const el = featuredScrollerRef.current;
      if (!el) return;
      featuredDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        scrollLeft0: el.scrollLeft,
        moved: false,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [finePointer, reducedMotion],
  );

  const onFeaturedPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = featuredDragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const el = featuredScrollerRef.current;
    if (!el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      setFeaturedScrollerDragging(true);
    }
    if (d.moved) {
      el.scrollLeft = d.scrollLeft0 - dx * 1.35;
    }
  }, []);

  const endFeaturedDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = featuredDragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const el = featuredScrollerRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (d.moved) {
      featuredNavBlockUntilRef.current = Date.now() + 450;
    }
    featuredDragRef.current = { pointerId: null, startX: 0, scrollLeft0: 0, moved: false };
    setFeaturedScrollerDragging(false);
  }, []);

  function scrollBrowse(dir: -1 | 1) {
    const el = browseScrollerRef.current;
    if (!el) return;
    const card = el.querySelector("[data-book-card]") as HTMLElement | null;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(el).gap || "0");
    const step = card.getBoundingClientRect().width + gap;
    el.scrollBy({ left: dir * step * 3, behavior: "smooth" });
  }

  const [headerVisible, setHeaderVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHeaderVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const selectedLibraryEntry = useMemo(() => {
    if (!selectedBook) return undefined;
    return featuredLibrary.find((x) => x.bookId === selectedBook.id);
  }, [featuredLibrary, selectedBook]);

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
        href={`/discover/${book.id}`}
        className={`group block outline-none ${size === "grid" ? "w-full" : ""} ${size === "carousel" ? "relative block min-h-[240px] w-[160px]" : ""} ${size === "carousel" && !isLast ? "mr-[-20px]" : ""} ${size === "carousel" && finePointer && !reducedMotion ? "hover:!z-[85] focus-within:!z-[85]" : ""}`}
        style={
          size === "carousel"
            ? { position: "relative", zIndex: zIndexFromDistance(distanceBrowse) }
            : undefined
        }
      >
        {size === "carousel" ? (
          <div
            data-carousel-card
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-0"
            style={{ width: BROWSE_CAROUSEL_CARD_W, height: (BROWSE_CAROUSEL_CARD_W * 3) / 2 }}
          />
        ) : null}
        <article
          data-book-card
          className={`${cardClass} relative aspect-[2/3] overflow-visible ${size === "carousel" ? "z-10" : ""}`}
          style={carouselDepthStyle}
        >
          <div
            className={`absolute inset-0 origin-center scale-100 overflow-hidden rounded-xl border-0 bg-transparent shadow-none will-change-transform ${
              finePointer && !reducedMotion
                ? "transition-[transform,box-shadow] duration-300 ease-out group-hover:scale-[1.05] group-hover:shadow-xl group-hover:shadow-bg-overlay/40 group-focus-within:scale-[1.05] group-focus-within:shadow-xl group-focus-within:shadow-bg-overlay/40"
                : finePointer && reducedMotion
                  ? "transition-shadow duration-300 ease-out"
                  : "transition-transform duration-200 ease-out active:scale-[0.99]"
            }`}
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
              className={`absolute inset-0 flex items-center justify-center bg-bg-overlay/45 transition-opacity duration-300 ease-out ${finePointer ? "opacity-0 group-hover:opacity-100" : "opacity-0"}`}
            >
              <span className="rounded-md bg-bg-surface/85 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-primary">
                View Book
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <div
      className={`discover-root min-h-screen pb-20 pt-6 text-text-primary sm:pt-10 ${!searchActive && showFeatured ? "discover-root--concept" : ""}`}
    >
      <div className="discover-root-inner mx-auto max-w-7xl px-4 sm:px-6">
        {!searchActive ? (
          <header className="discover-concept-hero discover-concept-hero--browse">
            <h1
              className={`discover-concept-title ${headerVisible ? "discover-concept-hero-in" : "opacity-0 translate-y-3"}`}
            >
              Discover your next read
            </h1>
          </header>
        ) : null}

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
              placeholder="Search by title, author, or genre..."
              className="discover-search-input w-full rounded-xl border border-border bg-bg-surface px-10 py-3 text-sm text-text-primary transition duration-200 ease-out placeholder:text-text-muted"
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
          <section className="mb-10 sm:mb-12">
            <div className="discover-concept-section-head mb-6 px-1 sm:px-0">
              <h2 className="discover-concept-section-title">Featured titles</h2>
              <div className="discover-concept-section-line" />
              {finePointer && !reducedMotion ? (
                <span className="discover-concept-drag-hint">Drag to explore →</span>
              ) : null}
            </div>
            <div
              ref={featuredScrollerRef}
              onPointerDownCapture={onFeaturedPointerDown}
              onPointerMove={onFeaturedPointerMove}
              onPointerUp={endFeaturedDrag}
              onPointerCancel={endFeaturedDrag}
              onPointerLeave={(e) => {
                if (featuredDragRef.current.pointerId === e.pointerId) endFeaturedDrag(e);
              }}
              className={`discover-no-h-scrollbar discover-concept-shelf-row -mx-4 flex items-end gap-6 overflow-x-auto px-6 pb-6 pt-10 sm:mx-0 sm:px-8 ${
                centerFeaturedRow ? "sm:justify-center" : ""
              } ${featuredScrollerDragging ? "discover-featured-scroller--dragging" : ""}`}
            >
              {featured.map((book, i) => (
                <ShelfFeaturedCard
                  key={book.id}
                  book={book}
                  index={i}
                  isSelected={i === selectedFeaturedIndex}
                  reducedMotion={reducedMotion}
                  finePointer={finePointer}
                  shelfHoverIndex={featuredShelfHoverIndex}
                  onShelfHoverIndex={setFeaturedShelfHoverIndex}
                  onSelect={() => setSelectedFeaturedIndex(i)}
                />
              ))}
            </div>

            {selectedBook ? (
              <div
                key={selectedBook.id}
                className="discover-concept-detail mt-2 flex flex-col gap-6 px-2 sm:flex-row sm:items-start sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="discover-concept-detail-genre font-mono text-[11px] uppercase tracking-[0.2em]">
                    {selectedBook.genre ? formatGenre(selectedBook.genre).toUpperCase() : "FEATURED"}
                  </div>
                  <div className="mt-1 font-serif text-2xl text-white sm:text-3xl">{selectedBook.title}</div>
                  <div className="mt-1 text-sm italic text-white/50">by {selectedBook.author}</div>
                  {selectedBook.description ? (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 line-clamp-4">
                      {selectedBook.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-5 sm:ml-auto sm:shrink-0">
                  <div className="discover-panel-readers" aria-label={`${selectedBook.readerCount.toLocaleString()} readers`}>
                    <span className="discover-panel-readers-count">
                      {selectedBook.readerCount.toLocaleString()}
                    </span>
                    <span className="discover-panel-readers-label">Readers</span>
                  </div>
                  <BookLibraryActions
                    bookId={selectedBook.id}
                    initialInLibrary={selectedLibraryEntry?.inLibrary ?? false}
                    isLoggedIn={isLoggedIn}
                    variant="discoverGold"
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!searchActive && showFeatured ? (
          <section className="mb-12 px-1 sm:px-0">
            <div className="discover-concept-visions-head mb-6 flex flex-wrap items-center gap-4">
              <h2 className="discover-concept-section-title m-0 shrink-0">Community visions</h2>
              <div className="discover-concept-section-line min-w-[4rem] flex-1" />
            </div>
            {visionsLoading ? (
              <p className="py-16 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                Loading community picks…
              </p>
            ) : visionImages.length === 0 ? (
              <p className="py-16 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                No featured gallery images yet. Be the first
              </p>
            ) : (
              <div className="discover-concept-masonry">
                {visionImages.map((img, i) => (
                  <div key={`${img.bookId}-${img.id}`} className="discover-concept-masonry-item">
                    <div
                      className="discover-concept-vision-card group"
                      style={
                        !reducedMotion
                          ? ({ animationDelay: `${Math.min(i, 24) * 70}ms` } as CSSProperties)
                          : undefined
                      }
                    >
                      <Link
                        href={`/gallery/${img.bookId}`}
                        className="block outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.imageUrl} alt="" className="discover-concept-vision-img" />
                        <div className="discover-concept-vision-grad" />
                        <div className="discover-concept-vision-badge font-mono">CH. {img.chapterNumberAtTime}</div>
                        <div className="discover-concept-vision-bottom">
                          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-text">
                            {img.bookTitle}
                          </div>
                          <div className="mt-1 font-serif text-xs leading-snug text-white/85 line-clamp-2">
                            {img.userPrompt}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-white/40">
                            <span>@{img.username}</span>
                            <span className="inline-flex items-center gap-1 text-white/45" title="Comments">
                              <MessageCircle className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                              <span>{img.commentCount ?? 0}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!searchActive ? (
          <>
            <div className="discover-concept-visions-head mb-3 flex flex-wrap items-center gap-4">
              <h2 className="discover-concept-section-title m-0 shrink-0">
                Browse {selectedGenreName} Books
              </h2>
              <div className="discover-concept-section-line min-w-[4rem] flex-1" />
              {filteredByGenre.length > 20 ? (
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className="shrink-0 text-sm font-medium text-accent-text transition duration-200 hover:underline underline-offset-2"
                >
                  {expanded ? "Show Less ↑" : "View All →"}
                </button>
              ) : null}
            </div>
            <section className="mb-3">
              <h2 className="sr-only">Filter by genre</h2>
              <div
                className={`discover-no-h-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 ${
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
                      className={`discover-genre-pill shrink-0 rounded-full px-4 py-2 text-xs font-medium outline-none sm:text-sm ${
                        finePointer ? "hover:scale-105 hover:brightness-110" : "active:brightness-125"
                      } ${
                        active
                          ? `discover-genre-pill-active ${!reducedMotion ? "discover-pill-pulse" : ""}`
                          : "bg-bg-raised text-text-secondary"
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
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
                {searchResults.map((book, i) =>
                  reducedMotion ? (
                    <BookCard key={book.id} book={book} size="grid" />
                  ) : (
                    <div
                      key={book.id}
                      className="discover-grid-cell"
                      style={{ animationDelay: `${Math.min(i, 20) * 60}ms` }}
                    >
                      <BookCard book={book} size="grid" />
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            <section ref={browseSectionRef} className="mb-8">
              <div className="relative">
                <div
                  ref={browseScrollerRef}
                  className="discover-no-h-scrollbar relative flex gap-0 overflow-x-auto py-10 pb-4 pr-4"
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
                      {expandedBooks.map((book, i) =>
                        reducedMotion ? (
                          <BookCard key={book.id} book={book} size="grid" />
                        ) : (
                          <div
                            key={book.id}
                            className="discover-grid-cell"
                            style={{ animationDelay: `${Math.min(i, 20) * 60}ms` }}
                          >
                            <BookCard book={book} size="grid" />
                          </div>
                        ),
                      )}
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

        {!searchActive && showFeatured && !isLoggedIn ? (
          <section className="discover-concept-cta relative mt-16 overflow-hidden rounded-lg border border-accent/18 px-6 py-10 sm:mt-20 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-dim to-transparent" />
            {!reducedMotion ? <DiscoverParticleField /> : null}
            <div className="relative z-[1] flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-text-muted">
                  Begin your journey
                </p>
                <p className="mt-3 font-serif text-2xl text-white sm:text-3xl">Read without fear.</p>
                <p className="mt-2 max-w-md text-sm italic text-white/40">
                  Your AI companion respects every page you haven&apos;t turned yet.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/sign-in"
                  className="rounded border-0 bg-accent px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-text-on-accent transition hover:brightness-110"
                >
                  Join free →
                </Link>
                <Link
                  href="/discover"
                  className="rounded border border-accent/35 bg-transparent px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-accent/75 transition hover:border-accent/55 hover:text-text-primary"
                >
                  Browse books
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <BookRequestModal open={bookRequestOpen} onClose={() => setBookRequestOpen(false)} />
      </div>
    </div>
  );
}
