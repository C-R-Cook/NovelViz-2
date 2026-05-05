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
      const nextLikeCount = data.likeCount;

      setImageList((prev) =>
        prev.map((image) => (image.id === imageId ? { ...image, likeCount: nextLikeCount } : image)),
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
      ? "border-accent/45 bg-accent-muted text-accent-text shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--accent)_14%,transparent)]"
      : "border-border/90 bg-bg-surface/90 text-text-muted hover:border-border hover:bg-bg-raised/80 hover:text-text-primary";
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
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Gallery
        </h1>
        <p className="text-sm text-text-secondary">Images created by readers</p>
      </header>

      <div className="mt-6 flex flex-col gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
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
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
              aria-autocomplete="list"
              aria-expanded={bookSuggestOpen}
              aria-controls="gallery-book-suggestions"
            />
            {activeBookFilterId || bookQuery.trim() ? (
              <button
                type="button"
                onClick={clearBookFilter}
                className="shrink-0 rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-bg-raised"
              >
                Clear
              </button>
            ) : null}
          </div>
          {bookSuggestOpen && bookSuggestions.length > 0 ? (
            <ul
              id="gallery-book-suggestions"
              role="listbox"
              className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border/95 bg-bg-surface py-1 shadow-lg"
            >
              {bookSuggestions.map((b) => (
                <li key={b.bookId} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-surface"
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
        <p className="mt-6 rounded-lg border border-border bg-bg-base/80 px-4 py-3 text-sm text-text-secondary">
          You haven&apos;t added any books to your library yet.{" "}
          <Link
            href="/discover"
            className="font-medium text-accent-text underline decoration-accent/40 underline-offset-2 hover:text-accent-text"
          >
            Discover books
          </Link>
        </p>
      ) : visibleImages.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-bg-base/80 px-4 py-3 text-sm text-text-secondary">
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
                className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm shadow-bg-overlay/5"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-base">
                  {mainTab === "featured" ? (
                    <span className="absolute left-2 top-2 z-10 rounded border border-accent/40 bg-bg-base/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text/95 shadow-sm">
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-overlay/70 px-3 text-center">
                      <LockIcon className="h-8 w-8 text-accent-text/90" />
                      {!isLoggedIn ? (
                        <p className="text-sm font-medium text-text-primary">Sign in to unlock</p>
                      ) : image.spoilerLevel === "unstarted" ? (
                        <p className="max-w-[14rem] text-sm font-medium leading-snug text-text-primary">
                          Start reading {image.bookTitle} to unlock
                        </p>
                      ) : (
                        <>
                          <p className="max-w-[14rem] text-sm font-medium leading-snug text-text-primary">
                            Contains content from Chapter {image.chapterNumberAtTime}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedImageIds((prev) => ({ ...prev, [image.id]: true }))
                            }
                            className="rounded-md border border-accent/35 bg-status-pending/50 px-3 py-1.5 text-xs font-medium text-accent-text transition hover:bg-status-pending/60"
                          >
                            Show anyway
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-xs text-text-muted">
                    <Link
                      href={`/discover/${image.bookId}`}
                      className="transition-colors hover:text-accent-text hover:underline decoration-accent/35 underline-offset-2"
                    >
                      {image.bookTitle} · {image.bookAuthor}
                    </Link>
                  </p>
                  <p className="line-clamp-3 text-sm text-text-primary">{image.userPrompt}</p>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Chapter {image.chapterNumberAtTime}</span>
                    <span>{image.userName?.trim() || "Anonymous reader"}</span>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void likeImage(image.id)}
                      disabled={!!likingIds[image.id]}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
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
