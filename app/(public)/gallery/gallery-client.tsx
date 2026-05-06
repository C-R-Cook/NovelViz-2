"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type GallerySpoilerLevel = "none" | "spoiler" | "unstarted" | "public";

export type GalleryImageCard = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  likeCount: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  userName: string | null;
  spoilerLevel: GallerySpoilerLevel;
};

type Props = {
  fromLibraryImages: GalleryImageCard[];
  trendingImages: GalleryImageCard[];
  discoverImages: GalleryImageCard[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  /** When set, only the book’s image carousel is shown (used by `/gallery/[bookId]`). Main gallery omits this. */
  bookGallery?: { title: string; author: string } | null;
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

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function formatCardDate(iso: string) {
  const d = new Date(iso);
  // Keep formatting locale-friendly and stable (no custom tokens).
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function GalleryClient({
  fromLibraryImages,
  trendingImages,
  discoverImages,
  isLoggedIn,
  isAdmin,
  bookGallery = null,
}: Props) {
  const initialImagesById = useMemo(() => {
    const all = [...fromLibraryImages, ...trendingImages, ...discoverImages];
    const deduped = new Map<string, GalleryImageCard>();
    for (const img of all) deduped.set(img.id, img);
    return Object.fromEntries(deduped.entries());
  }, [discoverImages, fromLibraryImages, trendingImages]);

  const [imagesById, setImagesById] = useState<Record<string, GalleryImageCard>>(initialImagesById);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [revealedImageIds, setRevealedImageIds] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<{ carouselIds: string[]; index: number } | null>(null);

  useEffect(() => {
    setImagesById(initialImagesById);
    setRevealedImageIds({});
    setModalState(null);
  }, [initialImagesById]);

  const fromLibraryResolved = useMemo(
    () => fromLibraryImages.map((img) => imagesById[img.id] ?? img),
    [fromLibraryImages, imagesById],
  );
  const trendingResolved = useMemo(
    () => trendingImages.map((img) => imagesById[img.id] ?? img),
    [trendingImages, imagesById],
  );
  const discoverResolved = useMemo(
    () => discoverImages.map((img) => imagesById[img.id] ?? img),
    [discoverImages, imagesById],
  );

  function isImageLocked(image: GalleryImageCard): boolean {
    if (isAdmin) return false;
    if (image.spoilerLevel === "none") return false;
    if (image.spoilerLevel === "unstarted") return true;
    if (image.spoilerLevel === "public") return true;
    // spoiler => locked until user chooses "Show anyway"
    return !revealedImageIds[image.id];
  }

  async function likeImage(imageId: string) {
    if (!isLoggedIn && !isAdmin) return;
    if (likingIds[imageId]) return;

    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImagesById((prev) => {
      const img = prev[imageId];
      if (!img) return prev;
      return { ...prev, [imageId]: { ...img, likeCount: img.likeCount + 1 } };
    });

    try {
      const res = await fetch(`/api/gallery/${imageId}/like`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { likeCount?: number };
      if (!res.ok || typeof data.likeCount !== "number") {
        setImagesById((prev) => {
          const img = prev[imageId];
          if (!img) return prev;
          return { ...prev, [imageId]: { ...img, likeCount: Math.max(0, img.likeCount - 1) } };
        });
        return;
      }

      setImagesById((prev) => {
        const img = prev[imageId];
        if (!img) return prev;
        return { ...prev, [imageId]: { ...img, likeCount: data.likeCount! } };
      });
    } catch {
      setImagesById((prev) => {
        const img = prev[imageId];
        if (!img) return prev;
        return { ...prev, [imageId]: { ...img, likeCount: Math.max(0, img.likeCount - 1) } };
      });
    } finally {
      setLikingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  function openModal(carouselIds: string[], index: number) {
    setModalState({ carouselIds, index });
  }

  function closeModal() {
    setModalState(null);
  }

  useEffect(() => {
    if (!modalState) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      e.preventDefault();
      setModalState((prev) => {
        if (!prev) return prev;
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const nextIndex = prev.index + delta;
        if (nextIndex < 0 || nextIndex >= prev.carouselIds.length) return prev;
        return { ...prev, index: nextIndex };
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalState]);

  const modalActiveId = modalState ? modalState.carouselIds[modalState.index] : null;
  const modalActiveImage = modalActiveId ? imagesById[modalActiveId] : null;

  function SectionHeader({
    heading,
    subtitle,
    right,
  }: {
    heading: string;
    subtitle: string;
    right?: ReactNode;
  }) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            {heading}
          </div>
          <div className="mt-2 text-sm text-text-secondary">{subtitle}</div>
        </div>
        {right}
      </div>
    );
  }

  function SeeAllLink() {
    return (
      <a
        href="#"
        className="text-sm font-medium text-text-muted transition hover:text-accent-text hover:underline decoration-accent/35 underline-offset-2"
        onClick={(e) => e.preventDefault()}
      >
        See all
      </a>
    );
  }

  function GallerySquareCard({
    image,
    carouselIds,
    index,
  }: {
    image: GalleryImageCard;
    carouselIds: string[];
    index: number;
  }) {
    const locked = isImageLocked(image);

    const displayUserName = image.userName?.trim() || "Anonymous reader";
    const likeDisabled = !isLoggedIn || !!likingIds[image.id];

    return (
      <article
        tabIndex={0}
        role="button"
        aria-label={`Open image: ${image.bookTitle}`}
        className="group outline-none"
        onClick={() => openModal(carouselIds, index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openModal(carouselIds, index);
        }}
      >
        <div
          data-gallery-card
          className="relative w-[66vw] min-w-[66vw] md:w-[180px] md:min-w-[180px] lg:w-[200px] lg:min-w-[200px] xl:w-[220px] xl:min-w-[220px] aspect-square overflow-hidden rounded-xl border border-border bg-bg-base shadow-sm transition-transform duration-200 ease-out md:group-hover:scale-[1.03]"
        >
          <Image
            src={image.imageUrl}
            alt={image.userPrompt}
            fill
            unoptimized
            className={`object-cover transition-[filter] duration-200 ease-out ${
              locked ? "blur-[24px]" : "blur-0"
            }`}
            sizes="(max-width: 767px) 66vw, (min-width: 768px) 180px, (min-width: 1024px) 200px, 220px"
          />

          {/* Prompt tooltip (desktop) */}
          {image.userPrompt ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-16 z-30 opacity-0 transition-opacity duration-200 md:group-hover:opacity-100">
              <div className="rounded-lg border border-border/70 bg-bg-overlay/75 p-2.5 text-xs text-text-primary backdrop-blur-sm">
                <p className="line-clamp-3">{image.userPrompt}</p>
              </div>
            </div>
          ) : null}

          {/* Bottom gradient band */}
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className="h-2/5 bg-gradient-to-t from-bg-overlay/90 to-bg-overlay/0" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="pr-14">
                <p className="text-xs font-medium text-text-muted line-clamp-1">{image.bookTitle}</p>
                <p className="mt-1 text-[11px] text-text-secondary line-clamp-1">{displayUserName}</p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void likeImage(image.id);
                }}
                disabled={likeDisabled}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/70 px-2 py-1 text-xs font-medium text-text-primary opacity-80 transition duration-200 ease-out hover:opacity-100 md:group-hover:opacity-100 md:group-hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Like ${image.likeCount} times`}
              >
                <HeartIcon className="h-3.5 w-3.5" />
                <span>{image.likeCount}</span>
              </button>
            </div>
          </div>

          {/* Spoiler / lock overlay */}
          {locked ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg-overlay/45 px-4 text-center">
              <LockIcon className="h-9 w-9 text-accent-text/95" />

              {image.spoilerLevel === "unstarted" ? (
                <p className="max-w-[14rem] text-sm font-medium leading-snug text-text-primary">
                  Start reading {image.bookTitle}
                </p>
              ) : null}

              {image.spoilerLevel === "public" ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-medium leading-snug text-text-primary">Sign in to unlock</p>
                  <Link
                    href="/sign-in"
                    className="rounded-md border border-border/80 bg-bg-surface/70 px-3 py-1.5 text-xs font-medium text-accent-text transition duration-200 hover:bg-bg-raised"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Sign in
                  </Link>
                </div>
              ) : null}

              {image.spoilerLevel === "spoiler" ? (
                <>
                  <p className="text-sm font-medium leading-snug text-text-primary">Chapter {image.chapterNumberAtTime}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevealedImageIds((prev) => ({ ...prev, [image.id]: true }));
                    }}
                    className="rounded-md border border-accent/35 bg-status-pending/50 px-3 py-1.5 text-xs font-medium text-accent-text transition duration-200 hover:bg-status-pending/60"
                  >
                    Show anyway
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function CarouselRow({ title, images }: { title: string; images: GalleryImageCard[] }) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(true);

    function updateScrollState() {
      const el = scrollRef.current;
      if (!el) return;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft < maxScrollLeft - 2);
    }

    useEffect(() => {
      updateScrollState();
      const el = scrollRef.current;
      if (!el) return;

      const onScroll = () => updateScrollState();
      el.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        el.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", updateScrollState);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length]);

    function scrollByCards(dir: -1 | 1) {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.querySelector("[data-gallery-card]") as HTMLElement | null;
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(el).gap || "0");
      const step = cardRect.width + gap;
      el.scrollBy({ left: dir * step * 3, behavior: "smooth" });
    }

    const carouselIds = images.map((i) => i.id);

    return (
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 pr-4 scroll-smooth touch-pan-x overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label={title}
        >
          {images.map((image, idx) => (
            <GallerySquareCard key={image.id} image={image} carouselIds={carouselIds} index={idx} />
          ))}
        </div>

        {/* Desktop arrows */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden md:flex items-center">
          {canLeft ? (
            <button
              type="button"
              className="pointer-events-auto ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface/75 text-text-primary shadow-sm transition duration-200 ease-out hover:bg-bg-raised"
              aria-label="Scroll left"
              onClick={() => scrollByCards(-1)}
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden md:flex items-center justify-end">
          {canRight ? (
            <button
              type="button"
              className="pointer-events-auto mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface/75 text-text-primary shadow-sm transition duration-200 ease-out hover:bg-bg-raised"
              aria-label="Scroll right"
              onClick={() => scrollByCards(1)}
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const noImagesSignedIn = (message: string) => (
    <p className="rounded-lg border border-border/90 bg-bg-base/70 px-4 py-3 text-sm text-text-secondary">
      {message}{" "}
      <Link
        href="/library"
        className="font-medium text-accent-text underline decoration-accent/40 underline-offset-2 hover:text-accent-text"
      >
        View your library
      </Link>
    </p>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      {bookGallery ? (
        <>
          <header className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                  {bookGallery.title}
                </h1>
                <p className="text-sm text-text-secondary">{bookGallery.author}</p>
              </div>
              <Link
                href="/gallery"
                className="shrink-0 text-sm font-medium text-accent-text underline-offset-2 transition duration-200 hover:underline"
              >
                ← All gallery
              </Link>
            </div>
            <p className="text-sm text-text-muted">Public images from this book</p>
          </header>

          <div className="mt-8 space-y-10">
            <section className="space-y-4">
              <SectionHeader heading="IMAGES" subtitle="Reader-generated artwork" right={<SeeAllLink />} />
              <CarouselRow title="Book gallery" images={trendingResolved} />
            </section>
          </div>
        </>
      ) : (
        <>
          <header className="space-y-2">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              Gallery
            </h1>
            <p className="text-sm text-text-secondary">Images created by readers, chapter by chapter</p>
          </header>

          <div className="mt-8 space-y-10">
            {/* Carousel 1 */}
            <section className="space-y-4">
              <SectionHeader
                heading="FROM YOUR LIBRARY"
                subtitle="Images from books you're reading"
                right={<SeeAllLink />}
              />

              {!isLoggedIn ? (
                <div className="rounded-lg border border-border/90 bg-bg-base/70 p-4">
                  <p className="text-sm font-medium text-text-primary">Sign in to unlock your library gallery.</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    See images from the books you&apos;re currently reading, chapter by chapter.
                  </p>
                  <div className="mt-3">
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center rounded-md border border-border bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary transition duration-200 ease-out hover:bg-bg-raised/80"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              ) : fromLibraryResolved.length === 0 ? (
                noImagesSignedIn("No images yet from your books. Start reading and generate your first!")
              ) : (
                <CarouselRow title="From your library" images={fromLibraryResolved} />
              )}
            </section>

            {/* Carousel 2 */}
            <section className="space-y-4">
              <SectionHeader
                heading="TRENDING NOW"
                subtitle="Most loved images this week"
                right={<SeeAllLink />}
              />
              <CarouselRow title="Trending now" images={trendingResolved} />
            </section>

            {/* Carousel 3 */}
            <section className="space-y-4">
              <SectionHeader
                heading="DISCOVER"
                subtitle="Images from books you haven't explored yet"
                right={<SeeAllLink />}
              />
              <CarouselRow title="Discover gallery" images={discoverResolved} />
            </section>
          </div>
        </>
      )}

      {/* Image modal */}
      {modalState && modalActiveImage ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-xl border border-border bg-bg-surface shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary transition duration-200 ease-out hover:bg-bg-raised"
              onClick={closeModal}
              aria-label="Close modal"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-col overflow-hidden sm:pt-1">
              <div className="relative flex h-[min(55vh,calc(90vh-12rem))] max-h-[55vh] w-full flex-shrink-0 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">
                <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border bg-bg-base">
                  <Image
                    src={modalActiveImage.imageUrl}
                    alt={modalActiveImage.userPrompt}
                    fill
                    unoptimized
                    className="object-contain object-center"
                    sizes="(max-width: 800px) 100vw, 800px"
                    priority
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{modalActiveImage.bookTitle}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{modalActiveImage.bookAuthor}</p>
                  </div>

                  <p className="text-sm text-text-muted">
                    Generated at Chapter {modalActiveImage.chapterNumberAtTime}
                  </p>

                  <div className="rounded-lg border border-border/90 bg-bg-base/60 p-3">
                    <p className="text-sm font-medium text-text-muted">Your prompt</p>
                    <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{modalActiveImage.userPrompt}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => void likeImage(modalActiveImage.id)}
                      disabled={!isLoggedIn || !!likingIds[modalActiveImage.id]}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary transition duration-200 ease-out hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Like this image"
                    >
                      <HeartIcon className="h-4 w-4" />
                      <span>{modalActiveImage.likeCount}</span>
                    </button>

                    <div className="text-sm text-text-muted">
                      <span>{modalActiveImage.userName?.trim() || "Anonymous reader"}</span>
                      <span className="mx-2 text-text-secondary/80" aria-hidden>
                        •
                      </span>
                      <span>{formatCardDate(modalActiveImage.createdAt)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <Link
                      href={`/gallery/${modalActiveImage.bookId}`}
                      className="text-sm text-accent-text/90 underline-offset-2 transition duration-200 hover:text-accent-text hover:underline"
                    >
                      View all {modalActiveImage.bookTitle} images
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
