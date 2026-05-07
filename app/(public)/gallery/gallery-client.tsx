"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { SpoilerToggle } from "@/components/gallery/spoiler-toggle";
import type { SpoilerProtection } from "@db";

export type GalleryLockKind = "none" | "chapter" | "unstarted" | "guest_blur";

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
  currentChapterNumber?: number;
  spoilerSetting?: SpoilerProtection;
  /** Server-computed; guest featured carousel ignores locking UI on purpose */
  isLocked: boolean;
  lockKind: GalleryLockKind;
};

export type GalleryClientProps =
  | {
      layout: "guest";
      latestFeatured: GalleryImageCard[];
      libraryBlur: GalleryImageCard[];
    }
  | {
      layout: "member";
      isAdmin: boolean;
      globalSpoilerProtection: boolean;
      library:
        | { kind: "no_books" }
        | { kind: "no_images" }
        | { kind: "images"; images: GalleryImageCard[] };
      featured: GalleryImageCard[];
      spoilerSettingsByBookId: Record<string, SpoilerProtection>;
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
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function GalleryClient(props: GalleryClientProps) {
  const router = useRouter();
  const isMember = props.layout === "member";
  const isLoggedIn = isMember;
  const isAdmin = isMember && props.isAdmin;
  const canLike = isLoggedIn || isAdmin;

  const cardSources = useMemo(() => {
    if (props.layout === "guest") {
      return [...props.latestFeatured, ...props.libraryBlur];
    }
    const lib =
      props.library.kind === "images"
        ? props.library.images
        : [];
    return [...lib, ...props.featured];
  }, [props]);

  const initialImagesById = useMemo(() => {
    const deduped = new Map<string, GalleryImageCard>();
    for (const img of cardSources) deduped.set(img.id, img);
    return Object.fromEntries(deduped.entries());
  }, [cardSources]);

  const [imagesById, setImagesById] = useState<Record<string, GalleryImageCard>>(initialImagesById);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<{ carouselIds: string[]; index: number } | null>(null);
  const [spoilerSettingsByBookId, setSpoilerSettingsByBookId] = useState<Record<string, SpoilerProtection>>(
    props.layout === "member" ? props.spoilerSettingsByBookId : {},
  );

  useEffect(() => {
    setImagesById(initialImagesById);
    setModalState(null);
    if (props.layout === "member") {
      setSpoilerSettingsByBookId(props.spoilerSettingsByBookId);
    }
  }, [initialImagesById]);

  const resolveList = (list: GalleryImageCard[]) => list.map((img) => imagesById[img.id] ?? img);

  const latestFeaturedResolved = props.layout === "guest" ? resolveList(props.latestFeatured) : [];
  const libraryBlurResolved = props.layout === "guest" ? resolveList(props.libraryBlur) : [];
  const fromLibraryResolved =
    props.layout === "member" && props.library.kind === "images" ? resolveList(props.library.images) : [];
  const featuredResolved = props.layout === "member" ? resolveList(props.featured) : [];

  function isImageLocked(image: GalleryImageCard): boolean {
    if (isAdmin) return false;
    return image.isLocked;
  }

  async function likeImage(imageId: string) {
    if (!canLike) return;
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
  const modalLocked = modalActiveImage ? isImageLocked(modalActiveImage) : false;
  const chapterGap =
    modalActiveImage && modalLocked
      ? Math.max(1, modalActiveImage.chapterNumberAtTime - (modalActiveImage.currentChapterNumber ?? 0))
      : null;

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
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{heading}</div>
          <div className="mt-2 text-sm text-text-secondary">{subtitle}</div>
        </div>
        {right}
      </div>
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
    const likeDisabled = !canLike || !!likingIds[image.id];

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
            className={`object-cover transition-[filter] duration-200 ease-out ${locked ? "blur-[24px]" : "blur-0"}`}
            sizes="(max-width: 767px) 66vw, (min-width: 768px) 180px, (min-width: 1024px) 200px, 220px"
          />

          {image.userPrompt ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-16 z-30 opacity-0 transition-opacity duration-200 md:group-hover:opacity-100">
              <div className="rounded-lg border border-border/70 bg-bg-overlay/75 p-2.5 text-xs text-text-primary backdrop-blur-sm">
                <p className="line-clamp-3">{image.userPrompt}</p>
              </div>
            </div>
          ) : null}

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

          {locked ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg-overlay/45 px-4 text-center">
              <LockIcon className="h-9 w-9 text-accent-text/95" />

              {image.lockKind === "unstarted" ? (
                <p className="max-w-[14rem] text-sm font-medium leading-snug text-text-primary">Start reading {image.bookTitle}</p>
              ) : null}

              {image.lockKind === "chapter" ? (
                <p className="text-sm font-medium leading-snug text-text-primary">Chapter {image.chapterNumberAtTime}</p>
              ) : null}

              {image.lockKind === "guest_blur" ? (
                <span className="sr-only">Preview locked — create an account to unlock your library gallery</span>
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

  async function toggleGlobalSpoiler() {
    if (props.layout !== "member") return;
    const next = !props.globalSpoilerProtection;
    await fetch("/api/user/spoiler-protection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    router.refresh();
  }

  async function unlockBookSpoilers(bookId: string) {
    const res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setting: "UNLOCKED" }),
    });
    if (!res.ok) return;
    closeModal();
    router.refresh();
  }

  function GlobalSpoilerPill() {
    if (props.layout !== "member") return null;
    const on = props.globalSpoilerProtection;
    return (
      <button
        type="button"
        onClick={() => void toggleGlobalSpoiler()}
        className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 ${
          on
            ? "border-error/35 bg-error/10 text-error"
            : "border-success/35 bg-success/10 text-success"
        }`}
      >
        {on ? "Spoilers hidden" : "Showing everything"}
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Gallery</h1>
        <p className="text-sm text-text-secondary">Images created by readers, chapter by chapter</p>
      </header>

      {props.layout === "guest" ? (
        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <SectionHeader
              heading="LATEST FEATURED"
              subtitle="Hand-picked images from our community"
            />
            <CarouselRow title="Latest featured" images={latestFeaturedResolved} />
          </section>

          <section className="relative space-y-4">
            <SectionHeader heading="YOUR LIBRARY" subtitle="Images from books you're reading" />
            <div className="relative">
              <CarouselRow title="Library preview" images={libraryBlurResolved} />
              <div
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-bg-overlay/55 px-4 backdrop-blur-[2px]"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
                <div className="pointer-events-auto max-w-md rounded-xl border border-border/90 bg-bg-surface/95 px-6 py-5 text-center shadow-lg backdrop-blur-md">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-base">
                    <LockIcon className="h-5 w-5 text-accent-text" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Create a free account to unlock your personalised gallery</p>
                  <div className="mt-4">
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center justify-center rounded-md border border-accent/40 bg-accent/15 px-4 py-2.5 text-sm font-semibold text-accent-text transition hover:bg-accent/25"
                    >
                      Get Started
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <SectionHeader heading="FROM YOUR LIBRARY" subtitle="Images from books you're reading" />
            {props.library.kind === "no_books" ? (
              <div className="rounded-lg border border-border/90 bg-bg-base/70 px-4 py-6 text-center">
                <p className="text-sm text-text-secondary">Add books to your library to see images from what you&apos;re reading.</p>
                <div className="mt-4">
                  <Link
                    href="/discover"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-bg-raised px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-raised/80"
                  >
                    Discover Books
                  </Link>
                </div>
              </div>
            ) : props.library.kind === "no_images" ? (
              <p className="rounded-lg border border-border/90 bg-bg-base/70 px-4 py-3 text-sm text-text-secondary">
                No community images yet from your library books. Check back soon, or explore the featured carousel below.
              </p>
            ) : (
              <CarouselRow title="From your library" images={fromLibraryResolved} />
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader
              heading="FEATURED"
              subtitle="Beloved images from across the catalogue"
              right={<GlobalSpoilerPill />}
            />
            <CarouselRow title="Featured" images={featuredResolved} />
          </section>
        </div>
      )}

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
                    className={`object-contain object-center ${modalLocked ? "blur-[24px]" : ""}`}
                    sizes="(max-width: 800px) 100vw, 800px"
                    priority
                  />
                  {modalLocked ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg-overlay/45 px-4 text-center">
                      <LockIcon className="h-10 w-10 text-accent-text/95" />
                      <p className="text-sm font-medium text-text-primary">Locked until you unlock this book</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{modalActiveImage.bookTitle}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{modalActiveImage.bookAuthor}</p>
                  </div>

                  <p className="text-sm text-text-muted">Generated at Chapter {modalActiveImage.chapterNumberAtTime}</p>

                  {!modalLocked ? (
                    <div className="rounded-lg border border-border/90 bg-bg-base/60 p-3">
                      <p className="text-sm font-medium text-text-muted">Your prompt</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{modalActiveImage.userPrompt}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => void likeImage(modalActiveImage.id)}
                      disabled={!canLike || !!likingIds[modalActiveImage.id]}
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

                  {modalLocked ? (
                    <div className="space-y-3 rounded-lg border border-border/90 bg-bg-base/60 p-3">
                      {chapterGap ? (
                        <p className="text-sm text-text-secondary">
                          You&apos;re {chapterGap} {chapterGap === 1 ? "chapter" : "chapters"} away
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void unlockBookSpoilers(modalActiveImage.bookId)}
                          className="inline-flex items-center rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-success transition hover:brightness-110 active:scale-95"
                        >
                          Unlock all {modalActiveImage.bookTitle} images
                        </button>
                        <Link
                          href={`/reader/${modalActiveImage.bookId}`}
                          onClick={() => closeModal()}
                          className="text-sm font-medium text-accent-text underline-offset-2 transition hover:underline"
                        >
                          Continue reading →
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  <div className="border-t border-border/80 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/gallery/${modalActiveImage.bookId}`}
                        className="text-sm text-accent-text/90 underline-offset-2 transition duration-200 hover:text-accent-text hover:underline"
                      >
                        View all {modalActiveImage.bookTitle} images →
                      </Link>
                      {props.layout === "member" ? (
                        <SpoilerToggle
                          bookId={modalActiveImage.bookId}
                          currentSetting={spoilerSettingsByBookId[modalActiveImage.bookId] ?? "INHERIT"}
                          globalSetting={props.globalSpoilerProtection}
                          onUpdate={(next) => {
                            setSpoilerSettingsByBookId((prev) => ({ ...prev, [modalActiveImage.bookId]: next }));
                            router.refresh();
                          }}
                        />
                      ) : null}
                    </div>
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
