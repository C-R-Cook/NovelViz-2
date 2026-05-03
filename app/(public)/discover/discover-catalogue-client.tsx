"use client";

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

export function DiscoverCatalogueClient({
  featured,
  initialBooks,
  initialNextCursor,
}: Props) {
  const [genre, setGenre] = useState("all");
  const [books, setBooks] = useState(initialBooks);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [gridLoading, setGridLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20 pt-6 text-zinc-100 sm:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mb-10 sm:mb-12">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Discover
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            Browse published titles with covers. Add what you love to your library.
          </p>
        </header>

        {showFeatured ? (
          <section className="mb-14 sm:mb-16">
            <h2 className="mb-5 px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
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
                {featured.map((book, i) => {
                  const offset = i - activeFeatured;
                  const scale = offset === 0 ? 1.06 : 0.88;
                  const rotateY = offset === 0 ? 0 : offset < 0 ? 14 : -14;
                  const z = offset === 0 ? 20 : 10 - Math.abs(offset);
                  return (
                    <Link
                      key={book.id}
                      href={`/discover/${book.id}`}
                      data-carousel-card
                      className="snap-center shrink-0 outline-none transition-[transform,opacity] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      style={{
                        transform: `rotateY(${rotateY}deg) scale(${scale})`,
                        zIndex: z,
                        transformStyle: "preserve-3d",
                      }}
                    >
                      <div className="relative w-[9.5rem] overflow-hidden rounded-lg sm:w-[11.5rem] md:w-[12.5rem]">
                        <div className="relative aspect-[2/3] w-full">
                          <Image
                            src={book.coverImageUrl}
                            alt={book.title}
                            fill
                            className="object-cover"
                            sizes="200px"
                            priority={i < 2}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pt-10">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-md">
                              {book.title}
                            </p>
                            <p className="mt-1 line-clamp-1 text-xs text-zinc-300">{book.author}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8">
          <h2 className="sr-only">Filter by genre</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GENRE_PILLS.map((pill) => {
              const active = genre === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => selectGenre(pill.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 sm:text-sm ${
                    active
                      ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50"
                      : "bg-zinc-800/60 text-zinc-400 ring-1 ring-transparent hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </section>

        {loadError ? (
          <p className="mb-6 text-center text-sm text-red-400/90">{loadError}</p>
        ) : null}

        <section aria-busy={gridLoading}>
          {gridLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div
                className="h-9 w-9 rounded-full border-2 border-zinc-700 border-t-amber-400/90 animate-spin"
                aria-label="Loading"
              />
            </div>
          ) : showEmpty ? (
            <div className="mx-auto max-w-md py-20 text-center">
              <p className="font-serif text-xl text-zinc-300">No books here</p>
              <p className="mt-3 text-sm text-zinc-500">
                Nothing published with a cover matches this genre yet. Try another filter.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                {books.map((book) => (
                  <Link
                    key={book.id}
                    href={`/discover/${book.id}`}
                    className="group relative aspect-[2/3] overflow-hidden rounded-md outline-none transition-transform duration-300 ease-out hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    <Image
                      src={book.coverImageUrl}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                    {book.genre ? (
                      <div className="absolute right-2 top-2 max-w-[55%] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                        {formatGenre(book.genre)}
                      </div>
                    ) : null}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5 pt-8 sm:p-3">
                      <p className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow sm:text-sm">
                        {book.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400 sm:text-xs">
                        {book.author}
                      </p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 ease-out group-hover:bg-black/40 group-hover:opacity-100">
                      <span className="rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-amber-400/40 backdrop-blur-sm">
                        View book
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              <div ref={sentinelRef} className="h-4 w-full" aria-hidden />

              <div className="mt-8 flex min-h-[2.5rem] flex-col items-center justify-center gap-2">
                {loadingMore ? (
                  <div
                    className="h-8 w-8 rounded-full border-2 border-zinc-700 border-t-amber-400/90 animate-spin"
                    aria-label="Loading more"
                  />
                ) : null}
                {!nextCursor && books.length > 0 && !loadingMore ? (
                  <p className="text-center text-xs text-zinc-600">No more books</p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
