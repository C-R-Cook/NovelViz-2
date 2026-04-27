"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type GallerySpoilerLevel = "none" | "chapter" | "unstarted";

export type GalleryImageCard = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  fullPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  likeCount: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  userName: string | null;
  spoilerLevel: GallerySpoilerLevel;
};

type GalleryMainTab = "my-books" | "featured" | "all";

type Props = {
  images: GalleryImageCard[];
  userLibraryBookIds: string[];
  isLoggedIn: boolean;
};

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function GalleryClient({ images, userLibraryBookIds, isLoggedIn }: Props) {
  const [imageList, setImageList] = useState<GalleryImageCard[]>(images);

  useEffect(() => {
    setImageList(images);
  }, [images]);
  const [mainTab, setMainTab] = useState<GalleryMainTab>(() =>
    isLoggedIn ? "my-books" : "featured",
  );
  const [bookQuery, setBookQuery] = useState("");
  const [activeBookFilterId, setActiveBookFilterId] = useState<string | null>(null);
  const [bookSuggestOpen, setBookSuggestOpen] = useState(false);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [gridOpacity, setGridOpacity] = useState(1);
  const filterTransitionReadyRef = useRef(false);
  const [revealedImageIds, setRevealedImageIds] = useState<Record<string, boolean>>({});

  const tabBaseImages = useMemo(() => {
    if (mainTab === "my-books") {
      const lib = new Set(userLibraryBookIds);
      return imageList.filter((img) => lib.has(img.bookId));
    }
    if (mainTab === "featured") {
      return [...imageList]
        .sort((a, b) => {
          if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 20);
    }
    return [...imageList].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [imageList, mainTab, userLibraryBookIds]);

  const booksInTab = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of tabBaseImages) {
      if (!map.has(img.bookId)) map.set(img.bookId, img.bookTitle);
    }
    return Array.from(map.entries())
      .map(([bookId, bookTitle]) => ({ bookId, bookTitle }))
      .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle));
  }, [tabBaseImages]);

  const bookSuggestions = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return booksInTab;
    return booksInTab.filter((b) => b.bookTitle.toLowerCase().includes(q));
  }, [bookQuery, booksInTab]);

  const visibleImages = useMemo(() => {
    if (!activeBookFilterId) return tabBaseImages;
    return tabBaseImages.filter((img) => img.bookId === activeBookFilterId);
  }, [tabBaseImages, activeBookFilterId]);

  useEffect(() => {
    if (!filterTransitionReadyRef.current) {
      filterTransitionReadyRef.current = true;
      return;
    }
    setGridOpacity(0.55);
    const id = window.setTimeout(() => setGridOpacity(1), 30);
    return () => window.clearTimeout(id);
  }, [mainTab, activeBookFilterId]);

  useEffect(() => {
    setActiveBookFilterId(null);
    setBookQuery("");
    setBookSuggestOpen(false);
  }, [mainTab]);

  async function likeImage(imageId: string) {
    if (likingIds[imageId]) return;

    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImageList((prev) =>
      prev.map((image) =>
        image.id === imageId ? { ...image, likeCount: image.likeCount + 1 } : image,
      ),
    );

    try {
      const res = await fetch(`/api/gallery/${imageId}/like`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { likeCount?: number };
      if (!res.ok || typeof data.likeCount !== "number") {
        setImageList((prev) =>
          prev.map((image) =>
            image.id === imageId ? { ...image, likeCount: Math.max(0, image.likeCount - 1) } : image,
          ),
        );
        return;
      }

      setImageList((prev) =>
        prev.map((image) => (image.id === imageId ? { ...image, likeCount: data.likeCount } : image)),
      );
    } catch {
      setImageList((prev) =>
        prev.map((image) =>
          image.id === imageId ? { ...image, likeCount: Math.max(0, image.likeCount - 1) } : image,
        ),
      );
    } finally {
      setLikingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  function isImageLocked(image: GalleryImageCard): boolean {
    if (!isLoggedIn) return true;
    if (image.spoilerLevel === "none") return false;
    if (image.spoilerLevel === "unstarted") return true;
    return !revealedImageIds[image.id];
  }

  const tabPillBase =
    "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ease-out";

  function tabPillClasses(active: boolean) {
    return active
      ? "border-amber-700/45 bg-amber-950/40 text-amber-100 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.14)] dark:border-amber-500/35 dark:bg-amber-950/55 dark:text-amber-50 dark:shadow-[inset_0_1px_0_0_rgba(251,191,36,0.12)]"
      : "border-zinc-300/90 bg-zinc-100/90 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200";
  }

  function selectBookFromSearch(bookId: string, title: string) {
    setActiveBookFilterId(bookId);
    setBookQuery(title);
    setBookSuggestOpen(false);
  }

  function clearBookFilter() {
    setActiveBookFilterId(null);
    setBookQuery("");
    setBookSuggestOpen(false);
  }

  const showMyBooksEmpty =
    isLoggedIn && mainTab === "my-books" && tabBaseImages.length === 0 && !activeBookFilterId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Gallery
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Images created by readers</p>
      </header>

      <div className="mt-6 flex flex-col gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex flex-wrap gap-2">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setMainTab("my-books")}
              className={`${tabPillBase} ${tabPillClasses(mainTab === "my-books")}`}
            >
              My Books
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMainTab("featured")}
            className={`${tabPillBase} ${tabPillClasses(mainTab === "featured")}`}
          >
            Featured
          </button>
          <button
            type="button"
            onClick={() => setMainTab("all")}
            className={`${tabPillBase} ${tabPillClasses(mainTab === "all")}`}
          >
            All
          </button>
        </div>

        <div className="relative w-full min-w-0 sm:max-w-xs sm:shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={bookQuery}
              onChange={(e) => {
                setBookQuery(e.target.value);
                setActiveBookFilterId(null);
                setBookSuggestOpen(true);
              }}
              onFocus={() => setBookSuggestOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setBookSuggestOpen(false), 150);
              }}
              placeholder="Filter by book..."
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              aria-autocomplete="list"
              aria-expanded={bookSuggestOpen}
              aria-controls="gallery-book-suggestions"
            />
            {activeBookFilterId || bookQuery.trim() ? (
              <button
                type="button"
                onClick={clearBookFilter}
                className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Clear
              </button>
            ) : null}
          </div>
          {bookSuggestOpen && bookSuggestions.length > 0 ? (
            <ul
              id="gallery-book-suggestions"
              role="listbox"
              className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200/95 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {bookSuggestions.map((b) => (
                <li key={b.bookId} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectBookFromSearch(b.bookId, b.bookTitle)}
                  >
                    {b.bookTitle}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {showMyBooksEmpty ? (
        <p className="mt-6 rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          You haven&apos;t added any books to your library yet.{" "}
          <Link
            href="/books"
            className="font-medium text-amber-800 underline decoration-amber-800/40 underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:decoration-amber-400/50 dark:hover:text-amber-200"
          >
            Browse books
          </Link>
        </p>
      ) : visibleImages.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          No images match this filter.
        </p>
      ) : (
        <section
          style={{ opacity: gridOpacity }}
          className="mt-6 grid grid-cols-2 gap-4 transition-opacity duration-300 ease-out sm:grid-cols-3 lg:grid-cols-4"
        >
          {visibleImages.map((image) => {
            const locked = isImageLocked(image);
            return (
              <article
                key={image.id}
                className="overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:shadow-black/20"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
                  {mainTab === "featured" ? (
                    <span className="absolute left-2 top-2 z-10 rounded border border-amber-800/40 bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/95 shadow-sm dark:border-amber-600/35 dark:bg-amber-950/90">
                      Featured
                    </span>
                  ) : null}
                  <Image
                    src={image.imageUrl}
                    alt={image.userPrompt}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                    className={`object-cover transition-[filter,transform] duration-300 ease-out ${
                      locked ? "scale-105 blur-[24px]" : "scale-100 blur-0"
                    }`}
                  />
                  {locked ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-3 text-center">
                      <LockIcon className="h-8 w-8 text-amber-200/90" />
                      {!isLoggedIn ? (
                        <p className="text-sm font-medium text-zinc-100">Sign in to unlock</p>
                      ) : image.spoilerLevel === "unstarted" ? (
                        <p className="max-w-[14rem] text-sm font-medium leading-snug text-zinc-100">
                          Start reading {image.bookTitle} to unlock
                        </p>
                      ) : (
                        <>
                          <p className="max-w-[14rem] text-sm font-medium leading-snug text-zinc-100">
                            Contains content from Chapter {image.chapterNumberAtTime}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedImageIds((prev) => ({ ...prev, [image.id]: true }))
                            }
                            className="rounded-md border border-amber-700/50 bg-amber-950/50 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-900/60"
                          >
                            Show anyway
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    <Link
                      href={`/books/${image.bookId}`}
                      className="transition-colors hover:text-amber-900 hover:underline decoration-amber-800/35 underline-offset-2 dark:hover:text-amber-200/90 dark:decoration-amber-400/40"
                    >
                      {image.bookTitle} · {image.bookAuthor}
                    </Link>
                  </p>
                  <p className="line-clamp-3 text-sm text-zinc-800 dark:text-zinc-200">{image.userPrompt}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
                    <span>Chapter {image.chapterNumberAtTime}</span>
                    <span>{image.userName?.trim() || "Anonymous reader"}</span>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void likeImage(image.id)}
                      disabled={!!likingIds[image.id]}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                    >
                      <span aria-hidden>♡</span>
                      <span>{image.likeCount}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
