"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GalleryCardCornerBadge } from "@/components/gallery/gallery-card-corner-badge";
import { SpoilerToggle } from "@/components/gallery/spoiler-toggle";
import { resolveLibraryPadlockBadge } from "@/lib/gallery-card-spoiler-badge";
import { HelpCircle, LockKeyholeOpen, Star } from "lucide-react";
import type { SpoilerProtection } from "@db";

export type GalleryLockKind = "none" | "chapter" | "unstarted" | "guest_blur";

export type GalleryImageCard = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  likeCount: number;
  /** True once the viewer has liked this image (persists via API). Guests always false from server. */
  likedByViewer: boolean;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  userName: string | null;
  userId: string;
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
      viewerUserId: null;
    }
  | {
      layout: "member";
      isAdmin: boolean;
      viewerUserId: string;
      globalSpoilerProtection: boolean;
      /** Books the viewer has active in their library (UserBook rows). */
      libraryBookIds: string[];
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

function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  const path =
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
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

const EMPTY_GALLERY_LIST: GalleryImageCard[] = [];

function imagesByIdFromCards(cards: GalleryImageCard[]): Record<string, GalleryImageCard> {
  const map = new Map<string, GalleryImageCard>();
  for (const img of cards) map.set(img.id, img);
  return Object.fromEntries(map.entries());
}

/** Merge RSC payload into client store without dropping optimistic `likedByViewer` before the next refresh. */
function mergeGalleryServerImages(
  server: Record<string, GalleryImageCard>,
  prev: Record<string, GalleryImageCard>,
): Record<string, GalleryImageCard> {
  const next: Record<string, GalleryImageCard> = {};
  for (const id of Object.keys(server)) {
    const s = server[id]!;
    const p = prev[id];
    next[id] = {
      ...s,
      likedByViewer: s.likedByViewer || !!p?.likedByViewer,
    };
  }
  return next;
}

type GallerySquareCardProps = {
  image: GalleryImageCard;
  carouselIds: string[];
  index: number;
  badgeMode: "off" | "featured" | "library";
  viewerUserId: string | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  canLike: boolean;
  likingIds: Record<string, boolean>;
  onLike: (id: string) => void;
  openModal: (carouselIds: string[], index: number) => void;
  locked: boolean;
};

function GallerySquareCard({
  image,
  carouselIds,
  index,
  badgeMode,
  viewerUserId,
  isAdmin,
  globalSpoilerProtection,
  canLike,
  likingIds,
  onLike,
  openModal,
  locked,
}: GallerySquareCardProps) {
  const displayUserName = image.userName?.trim() || "Anonymous reader";
  const alreadyLiked = image.likedByViewer;
  const likeDisabled = !canLike || !!likingIds[image.id] || alreadyLiked || locked;
  const isOwnImage = viewerUserId !== null && viewerUserId === image.userId;
  const padlockVariant =
    badgeMode === "library"
      ? resolveLibraryPadlockBadge({
          viewerUserId,
          isAdmin,
          globalSpoilerProtection,
          bookSpoilerSetting: image.spoilerSetting ?? "INHERIT",
          imageUserId: image.userId,
          imageChapter: image.chapterNumberAtTime,
          currentChapter: image.currentChapterNumber,
          locked,
        })
      : null;

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
        {!locked && badgeMode === "featured" && viewerUserId !== null ? (
          <GalleryCardCornerBadge kind="featured-star" />
        ) : null}
        {!locked && padlockVariant ? (
          <GalleryCardCornerBadge kind="library-padlock" variant={padlockVariant} />
        ) : null}

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

            {isOwnImage ? (
              <span
                title="You created this"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/70 px-2 py-1 text-xs font-medium text-text-muted opacity-90"
              >
                <HeartIcon className="h-3.5 w-3.5" />
                <span>{image.likeCount}</span>
              </span>
            ) : locked ? (
              <span
                title={alreadyLiked ? "You liked this — unlock the image to interact" : "Unlock to like"}
                className="absolute bottom-2 right-2 inline-flex cursor-default items-center gap-1 rounded-md border border-border/80 bg-bg-surface/70 px-2 py-1 text-xs font-medium text-text-muted opacity-90"
              >
                <HeartIcon filled={alreadyLiked} className={`h-3.5 w-3.5 shrink-0 ${alreadyLiked ? "text-red-500/80" : ""}`} />
                <span>{image.likeCount}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onLike(image.id);
                }}
                disabled={likeDisabled}
                className={`absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border bg-bg-surface/70 px-2 py-1 text-xs font-medium opacity-80 transition duration-200 ease-out hover:opacity-100 md:group-hover:opacity-100 md:group-hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${alreadyLiked ? "border-red-500/55 text-red-500" : "border-border/80 text-text-primary"}`}
                aria-label={
                  alreadyLiked
                    ? `You liked this (${image.likeCount})`
                    : `Like — ${image.likeCount} likes so far`
                }
              >
                <HeartIcon filled={alreadyLiked} className={`h-3.5 w-3.5 shrink-0 ${alreadyLiked ? "text-red-500" : ""}`} />
                <span>{image.likeCount}</span>
              </button>
            )}
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

type CarouselRowProps = {
  title: string;
  images: GalleryImageCard[];
  badgeMode: "off" | "featured" | "library";
  viewerUserId: string | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  canLike: boolean;
  likingIds: Record<string, boolean>;
  onLike: (id: string) => void;
  openModal: (carouselIds: string[], index: number) => void;
  isImageLocked: (image: GalleryImageCard) => boolean;
};

function CarouselRow({
  title,
  images,
  badgeMode,
  viewerUserId,
  isAdmin,
  globalSpoilerProtection,
  canLike,
  likingIds,
  onLike,
  openModal,
  isImageLocked,
}: CarouselRowProps) {
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
          <GallerySquareCard
            key={image.id}
            image={image}
            carouselIds={carouselIds}
            index={idx}
            badgeMode={badgeMode}
            viewerUserId={viewerUserId}
            isAdmin={isAdmin}
            globalSpoilerProtection={globalSpoilerProtection}
            canLike={canLike}
            likingIds={likingIds}
            onLike={onLike}
            openModal={openModal}
            locked={isImageLocked(image)}
          />
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

export function GalleryClient(props: GalleryClientProps) {
  const router = useRouter();
  const isMember = props.layout === "member";
  const isLoggedIn = isMember;
  const isAdmin = isMember && props.isAdmin;
  const canLike = isLoggedIn || isAdmin;
  const viewerUserId = isMember ? props.viewerUserId : null;

  const guestLatestFeatured = props.layout === "guest" ? props.latestFeatured : EMPTY_GALLERY_LIST;
  const guestLibraryBlur = props.layout === "guest" ? props.libraryBlur : EMPTY_GALLERY_LIST;
  const memberFeatured = props.layout === "member" ? props.featured : EMPTY_GALLERY_LIST;
  const memberLibraryImages =
    props.layout === "member" && props.library.kind === "images" ? props.library.images : EMPTY_GALLERY_LIST;

  const cardSources = useMemo(() => {
    if (props.layout === "guest") {
      return [...guestLatestFeatured, ...guestLibraryBlur];
    }
    return [...memberLibraryImages, ...memberFeatured];
  }, [props.layout, guestLatestFeatured, guestLibraryBlur, memberFeatured, memberLibraryImages]);

  const serverImagesById = useMemo(() => imagesByIdFromCards(cardSources), [cardSources]);

  const [imagesById, setImagesById] = useState<Record<string, GalleryImageCard>>(serverImagesById);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<{ carouselIds: string[]; index: number } | null>(null);
  const [modalCtaError, setModalCtaError] = useState<string | null>(null);
  const [modalUnlockPending, setModalUnlockPending] = useState(false);
  const [addLibraryPending, setAddLibraryPending] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [spoilerSettingsByBookId, setSpoilerSettingsByBookId] = useState<Record<string, SpoilerProtection>>(
    props.layout === "member" ? props.spoilerSettingsByBookId : {},
  );

  useEffect(() => {
    setImagesById((prev) => mergeGalleryServerImages(serverImagesById, prev));
  }, [serverImagesById]);

  const memberSpoilerSettings =
    props.layout === "member" ? props.spoilerSettingsByBookId : null;
  useEffect(() => {
    if (props.layout !== "member") return;
    setSpoilerSettingsByBookId(props.spoilerSettingsByBookId);
  }, [props.layout, memberSpoilerSettings]);

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

    const prior = imagesById[imageId];
    if (!prior || prior.likedByViewer) return;
    if (viewerUserId && prior.userId === viewerUserId) return;
    if (isImageLocked(prior)) return;

    const beforeLikeCount = prior.likeCount;
    const beforeLikedByViewer = prior.likedByViewer;

    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImagesById((prev) => {
      const img = prev[imageId];
      if (!img || img.likedByViewer) return prev;
      if (viewerUserId && img.userId === viewerUserId) return prev;
      return { ...prev, [imageId]: { ...img, likeCount: img.likeCount + 1, likedByViewer: true } };
    });

    try {
      const res = await fetch(`/api/gallery/${imageId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionBrowsingUnlockedBookIds: [] }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        likeCount?: number;
        error?: string;
        code?: string;
      };

      const revertLike = () => {
        setImagesById((prev) => {
          const img = prev[imageId];
          if (!img) return prev;
          return {
            ...prev,
            [imageId]: {
              ...img,
              likeCount: beforeLikeCount,
              likedByViewer: beforeLikedByViewer,
            },
          };
        });
      };

      if (!res.ok || typeof data.likeCount !== "number") {
        revertLike();
        return;
      }

      setImagesById((prev) => {
        const img = prev[imageId];
        if (!img) return prev;
        return { ...prev, [imageId]: { ...img, likeCount: data.likeCount!, likedByViewer: true } };
      });
    } catch {
      setImagesById((prev) => {
        const img = prev[imageId];
        if (!img) return prev;
        return {
          ...prev,
          [imageId]: {
            ...img,
            likeCount: beforeLikeCount,
            likedByViewer: beforeLikedByViewer,
          },
        };
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
    setModalCtaError(null);
  }

  const modalActiveId = modalState ? modalState.carouselIds[modalState.index] : null;
  const modalActiveImage = modalActiveId ? imagesById[modalActiveId] : null;
  useEffect(() => {
    setModalCtaError(null);
  }, [modalActiveId]);

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

  const modalLocked = modalActiveImage ? isImageLocked(modalActiveImage) : false;
  const chapterGap =
    modalActiveImage && modalLocked
      ? Math.max(1, modalActiveImage.chapterNumberAtTime - (modalActiveImage.currentChapterNumber ?? 0))
      : null;

  const bookInLibrary =
    props.layout === "member" &&
    modalActiveImage &&
    props.libraryBookIds.includes(modalActiveImage.bookId);

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
    setModalCtaError(null);
    setModalUnlockPending(true);
    try {
      let res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: "UNLOCKED" }),
      });

      const readErr = async () => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? null;

      if (res.ok) {
        closeModal();
        router.refresh();
        return;
      }

      if (res.status === 404) {
        const create = await fetch(`/api/library/${bookId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spoilerProtection: "UNLOCKED" }),
        });
        const createPayload = await create.json().catch(() => ({}));
        if (create.ok) {
          closeModal();
          router.refresh();
          return;
        }
        const rawCreateErr = (createPayload as { error?: string }).error;
        setModalCtaError(
          typeof rawCreateErr === "string" && rawCreateErr.trim() !== ""
            ? rawCreateErr
            : "Could not add this book or unlock spoilers.",
        );
        return;
      }

      const errLine = await readErr();
      setModalCtaError(typeof errLine === "string" && errLine.trim() !== "" ? errLine : "Could not unlock spoilers.");
    } finally {
      setModalUnlockPending(false);
    }
  }

  async function addBookFromGalleryModal(bookId: string, then: "reader" | "stay") {
    setModalCtaError(null);
    setAddLibraryPending(true);
    try {
      const res = await fetch(`/api/library/${bookId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoilerProtection: "PROTECTED" }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setModalCtaError(typeof payload.error === "string" ? payload.error : "Could not add to library.");
        return;
      }
      closeModal();
      if (then === "reader") router.push(`/reader/${bookId}`);
      else router.refresh();
    } finally {
      setAddLibraryPending(false);
    }
  }

  const carouselRowProps = {
    viewerUserId,
    isAdmin,
    globalSpoilerProtection: props.layout === "member" ? props.globalSpoilerProtection : true,
    canLike,
    likingIds,
    onLike: likeImage,
    openModal,
    isImageLocked,
  } satisfies Omit<CarouselRowProps, "title" | "images" | "badgeMode">;

  function GlobalSpoilerPill() {
    if (props.layout !== "member") return null;
    const hidden = props.globalSpoilerProtection;
    return (
      <button
        type="button"
        onClick={() => void toggleGlobalSpoiler()}
        className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 ${
          hidden
            ? "border-error/35 bg-error/10 text-error"
            : "border-success/35 bg-success/10 text-success"
        }`}
      >
        {hidden ? "Show everything" : "Hide spoilers"}
      </button>
    );
  }

  function BadgeLegend() {
    if (props.layout !== "member") return null;
    return (
      <div
        className="group relative"
        onMouseLeave={() => setLegendOpen(false)}
      >
        <button
          type="button"
          onClick={() => setLegendOpen((prev) => !prev)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface/70 text-text-muted transition hover:text-text-primary"
          aria-label="Show gallery icon legend"
          aria-expanded={legendOpen}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div
          className={`absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-bg-overlay/95 p-3 text-xs text-text-primary shadow-xl backdrop-blur-sm ${
            legendOpen ? "block" : "hidden group-hover:block"
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LockKeyholeOpen
                className="h-4 w-4"
                style={{ color: "#00BCD4", filter: "drop-shadow(0 0 4px rgba(0, 188, 212, 0.8))" }}
                aria-hidden
              />
              <span>Aqua - Your image</span>
            </div>
            <div className="flex items-center gap-2">
              <LockKeyholeOpen
                className="h-4 w-4"
                style={{ color: "#22C55E", filter: "drop-shadow(0 0 4px rgba(34, 197, 94, 0.8))" }}
                aria-hidden
              />
              <span>Green - Safe to view (within your reading progress)</span>
            </div>
            <div className="flex items-center gap-2">
              <LockKeyholeOpen
                className="h-4 w-4"
                style={{ color: "#EAB308", filter: "drop-shadow(0 0 4px rgba(234, 179, 8, 0.8))" }}
                aria-hidden
              />
              <span>Yellow - Visible (spoiler protection is off)</span>
            </div>
            <div className="flex items-center gap-2">
              <LockKeyholeOpen
                className="h-4 w-4"
                style={{ color: "#EF4444", filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))" }}
                aria-hidden
              />
              <span>Red - Unlocked for this book (global protection is on)</span>
            </div>
            <div className="flex items-center gap-2">
              <Star
                className="h-4 w-4"
                style={{ color: "#F59E0B", filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.8))" }}
                fill="currentColor"
                aria-hidden
              />
              <span>Gold star - Featured image</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4 gap-y-2">
        <div className="min-w-0 space-y-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Gallery</h1>
          <p className="text-sm text-text-secondary">Images created by readers, chapter by chapter</p>
        </div>
        {props.layout === "member" ? (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <BadgeLegend />
            <GlobalSpoilerPill />
          </div>
        ) : null}
      </header>

      {props.layout === "guest" ? (
        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <SectionHeader
              heading="LATEST FEATURED"
              subtitle="Hand-picked images from our community"
            />
            <CarouselRow
              {...carouselRowProps}
              badgeMode="off"
              title="Latest featured"
              images={latestFeaturedResolved}
            />
          </section>

          <section className="relative space-y-4">
            <SectionHeader heading="YOUR LIBRARY" subtitle="Images from books you're reading" />
            <div className="relative">
              <CarouselRow
                {...carouselRowProps}
                badgeMode="off"
                title="Library preview"
                images={libraryBlurResolved}
              />
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
              <CarouselRow
                {...carouselRowProps}
                badgeMode="library"
                title="From your library"
                images={fromLibraryResolved}
              />
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader heading="FEATURED" subtitle="Beloved images from across the catalogue" />
            <CarouselRow {...carouselRowProps} badgeMode="featured" title="Featured" images={featuredResolved} />
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
                    {viewerUserId !== null && modalActiveImage.userId === viewerUserId ? (
                      <span
                        title="You created this"
                        className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted"
                      >
                        <HeartIcon className="h-4 w-4 shrink-0" />
                        <span>{modalActiveImage.likeCount}</span>
                      </span>
                    ) : modalLocked ? (
                      <span
                        title={
                          modalActiveImage.likedByViewer
                            ? "You liked this — unlock the image to interact"
                            : "Unlock to like"
                        }
                        className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted"
                      >
                        <HeartIcon
                          filled={modalActiveImage.likedByViewer}
                          className={`h-4 w-4 shrink-0 ${modalActiveImage.likedByViewer ? "text-red-500/80" : ""}`}
                        />
                        <span>{modalActiveImage.likeCount}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void likeImage(modalActiveImage.id)}
                        disabled={
                          !canLike || !!likingIds[modalActiveImage.id] || modalActiveImage.likedByViewer
                        }
                        className={`inline-flex items-center gap-2 rounded-md border bg-bg-surface px-3 py-2 text-sm font-medium transition duration-200 ease-out hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60 ${modalActiveImage.likedByViewer ? "border-red-500/55 text-red-500" : "border-border text-text-primary"}`}
                        aria-label={
                          modalActiveImage.likedByViewer
                            ? `You liked this (${modalActiveImage.likeCount})`
                            : "Like this image"
                        }
                      >
                        <HeartIcon filled={modalActiveImage.likedByViewer} className={`h-4 w-4 shrink-0 ${modalActiveImage.likedByViewer ? "text-red-500" : ""}`} />
                        <span>{modalActiveImage.likeCount}</span>
                      </button>
                    )}

                    <div className="text-sm text-text-muted">
                      <span>{modalActiveImage.userName?.trim() || "Anonymous reader"}</span>
                      {viewerUserId !== null && modalActiveImage.userId === viewerUserId ? (
                        <span className="ml-2 inline-flex rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                          Your image
                        </span>
                      ) : null}
                      <span className="mx-2 text-text-secondary/80" aria-hidden>
                        •
                      </span>
                      <span>{formatCardDate(modalActiveImage.createdAt)}</span>
                    </div>
                  </div>

                  {modalLocked ? (
                    <div className="space-y-3 rounded-lg border border-border/90 bg-bg-base/60 p-3">
                      {modalCtaError ? <p className="text-sm text-error">{modalCtaError}</p> : null}
                      {props.layout === "guest" ? (
                        <p className="text-sm text-text-secondary">
                          Sign in to track reading progress and unlock gallery images tied to your library books.
                        </p>
                      ) : props.layout === "member" && !isAdmin && modalActiveImage && !bookInLibrary ? (
                        <>
                          <p className="text-sm text-text-secondary">
                            Add this book to your library to track your progress
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={addLibraryPending}
                              onClick={() => void addBookFromGalleryModal(modalActiveImage.bookId, "reader")}
                              className="inline-flex items-center rounded-md border border-accent/40 bg-accent-muted px-3 py-2 text-sm font-semibold text-text-primary ring-1 ring-accent/45 transition hover:bg-accent-hover/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add to Library &amp; Start Reading
                            </button>
                            <button
                              type="button"
                              disabled={addLibraryPending}
                              onClick={() => void addBookFromGalleryModal(modalActiveImage.bookId, "stay")}
                              className="text-sm font-medium text-accent-text underline-offset-2 transition hover:underline disabled:opacity-50"
                            >
                              Add to Library only
                            </button>
                          </div>
                        </>
                      ) : props.layout === "member" && !isAdmin && bookInLibrary ? (
                        <>
                          {chapterGap ? (
                            <p className="text-sm text-text-secondary">
                              You&apos;re {chapterGap} {chapterGap === 1 ? "chapter" : "chapters"} away
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={modalUnlockPending}
                              onClick={() => void unlockBookSpoilers(modalActiveImage.bookId)}
                              className="inline-flex items-center rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-success transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
                        </>
                      ) : null}
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
                      {props.layout === "member" && !modalLocked && bookInLibrary ? (
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
