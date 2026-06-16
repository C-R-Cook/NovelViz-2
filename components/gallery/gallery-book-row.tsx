"use client";

import { GalleryCardCornerBadge } from "@/components/gallery/gallery-card-corner-badge";
import { ImageThumbnailBottomBar } from "@/components/image-thumbnail-bottom-bar";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { resolveLibraryPadlockBadge } from "@/lib/gallery-card-spoiler-badge";
import type { BookGalleryRow, GalleryImageCard } from "@/lib/gallery-types";
import { formatGenre } from "@/lib/genre";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { SpoilerProtection } from "@db";

type Props = {
  row: BookGalleryRow;
  variant: "library" | "discovery";
  carouselIds: string[];
  viewerUserId: string | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  spoilerSetting: SpoilerProtection;
  canLike: boolean;
  likingIds: Record<string, boolean>;
  onLike: (id: string) => void;
  onOpenImage: (carouselIds: string[], index: number) => void;
  onDragMoved?: () => void;
  enableDragScroll: boolean;
  isLoggedIn: boolean;
  onAddToLibrary?: (bookId: string) => void;
  addLibraryPending?: boolean;
  onOpenCoverFallback?: (bookId: string) => void;
};

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

function GalleryRowImageCard({
  image,
  carouselIds,
  index,
  variant,
  viewerUserId,
  isAdmin,
  globalSpoilerProtection,
  canLike,
  likingIds,
  onLike,
  onOpenImage,
  isCoverFallback,
  onOpenCoverFallback,
}: {
  image: GalleryImageCard;
  carouselIds: string[];
  index: number;
  variant: "library" | "discovery";
  viewerUserId: string | null;
  isAdmin: boolean;
  globalSpoilerProtection: boolean;
  canLike: boolean;
  likingIds: Record<string, boolean>;
  onLike: (id: string) => void;
  onOpenImage: (carouselIds: string[], index: number) => void;
  isCoverFallback?: boolean;
  onOpenCoverFallback?: (bookId: string) => void;
}) {
  const locked = isAdmin ? false : image.isLocked;
  const isOwnImage = viewerUserId !== null && viewerUserId === image.userId;
  const likeDisabled =
    !canLike || !!likingIds[image.id] || image.likedByViewer || locked || isOwnImage;

  const padlockVariant =
    variant === "library" && !locked && !isCoverFallback
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

  const displayName = isCoverFallback
    ? "AI cover art"
    : image.userName?.trim() || "Anonymous reader";
  const carouselIndex = carouselIds.indexOf(image.id);

  const openCard = () => {
    if (isCoverFallback) {
      onOpenCoverFallback?.(image.bookId);
      return;
    }
    if (carouselIndex >= 0) onOpenImage(carouselIds, carouselIndex);
  };

  return (
    <article
      data-gallery-card
      tabIndex={0}
      role="button"
      aria-label={
        isCoverFallback
          ? `View ${image.bookTitle} in catalogue`
          : `Open image from ${image.bookTitle}`
      }
      className="gallery-book-row-card group shrink-0 outline-none"
      onClick={openCard}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCard();
        }
      }}
    >
      <div className="relative aspect-square w-[66vw] min-w-[66vw] overflow-hidden rounded-xl border border-border bg-bg-base shadow-sm md:w-[180px] md:min-w-[180px]">
        <Image
          src={image.imageUrl}
          alt={isCoverFallback ? `${image.bookTitle} cover` : image.userPrompt}
          fill
          unoptimized
          className={`object-cover transition-[filter] duration-200 ${locked ? "blur-[24px]" : "blur-0"} ${isCoverFallback ? "object-top" : ""}`}
          sizes="(max-width: 767px) 66vw, 180px"
        />
        {!locked && image.isFeatured ? <GalleryCardCornerBadge kind="featured-star" /> : null}
        {!locked && padlockVariant ? (
          <GalleryCardCornerBadge kind="library-padlock" variant={padlockVariant} />
        ) : null}
        {isCoverFallback ? (
          <span className="absolute left-2 top-2 z-10 rounded-full border border-border/80 bg-bg-surface/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Cover
          </span>
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[30%] bg-gradient-to-b from-black/45 to-transparent"
          aria-hidden
        />
        <ImageThumbnailBottomBar />
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="flex items-end justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">{displayName}</p>
            {isCoverFallback ? null : (
            <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
              <span className="pointer-events-none inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-primary shadow-sm">
                <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span>{image.commentCount}</span>
              </span>
              {isOwnImage ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-muted shadow-sm">
                  <HeartIcon className="h-3.5 w-3.5" />
                  <span>{image.likeCount}</span>
                </span>
              ) : locked ? (
                <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-muted shadow-sm">
                  <HeartIcon filled={image.likedByViewer} className={`h-3.5 w-3.5 ${image.likedByViewer ? "text-red-500/80" : ""}`} />
                  <span>{image.likeCount}</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={likeDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onLike(image.id);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium shadow-sm transition hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60 ${
                    image.likedByViewer ? "border-red-500/55 text-red-500" : "text-text-primary"
                  }`}
                >
                  <HeartIcon filled={image.likedByViewer} className={`h-3.5 w-3.5 ${image.likedByViewer ? "text-red-500" : ""}`} />
                  <span>{image.likeCount}</span>
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function InvitationCard({
  row,
  isLoggedIn,
  pending,
  onAdd,
  isCoverFallback,
}: {
  row: BookGalleryRow;
  isLoggedIn: boolean;
  pending?: boolean;
  onAdd?: (bookId: string) => void;
  isCoverFallback?: boolean;
}) {
  if (isCoverFallback) {
    return (
      <div className="invitation-card relative aspect-square w-[66vw] min-w-[66vw] shrink-0 overflow-hidden rounded-xl border border-accent/35 md:w-[180px] md:min-w-[180px]">
        {row.coverImageUrl ? (
          <Image
            src={row.coverImageUrl}
            alt=""
            fill
            unoptimized
            className="object-cover object-top blur-sm brightness-[0.35]"
            sizes="180px"
          />
        ) : (
          <div className="absolute inset-0 bg-bg-overlay/80" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 text-center">
          <p className="text-sm font-semibold text-text-primary">Explore this book</p>
          <Link
            href={`/discover/${row.bookId}`}
            className="rounded-md border border-accent/50 bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent-text transition hover:bg-accent/30"
          >
            View in catalogue
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAdd?.(row.bookId)}
              className="text-[11px] font-medium text-text-secondary underline-offset-2 hover:underline disabled:opacity-60"
            >
              + Add to library
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const moreCount = Math.max(1, row.totalPublicImages - row.images.length);

  return (
    <div className="invitation-card relative aspect-square w-[66vw] min-w-[66vw] shrink-0 overflow-hidden rounded-xl border border-accent/35 md:w-[180px] md:min-w-[180px]">
      {row.coverImageUrl ? (
        <Image
          src={row.coverImageUrl}
          alt=""
          fill
          unoptimized
          className="object-cover object-top blur-sm brightness-[0.35]"
          sizes="180px"
        />
      ) : (
        <div className="absolute inset-0 bg-bg-overlay/80" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 text-center">
        <p className="text-sm font-semibold text-text-primary">
          {moreCount} more image{moreCount === 1 ? "" : "s"} inside
        </p>
        {isLoggedIn ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onAdd?.(row.bookId)}
            className="rounded-md border border-accent/50 bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent-text transition hover:bg-accent/30 disabled:opacity-60"
          >
            + Add to library
          </button>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-accent/50 bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent-text transition hover:bg-accent/30"
          >
            + Add to library
          </Link>
        )}
      </div>
    </div>
  );
}

export function GalleryBookRow({
  row,
  variant,
  carouselIds,
  viewerUserId,
  isAdmin,
  globalSpoilerProtection,
  spoilerSetting,
  canLike,
  likingIds,
  onLike,
  onOpenImage,
  onDragMoved,
  enableDragScroll,
  isLoggedIn,
  onAddToLibrary,
  addLibraryPending,
  onOpenCoverFallback,
}: Props) {
  const { scrollRef, stripClassName, pointerHandlers } = useHorizontalDragScroll({
    enabled: enableDragScroll,
    onDragMoved,
  });

  return (
    <div className="book-row">
      <div className="book-row-anchor">
        <div className="relative mx-auto aspect-[2/3] w-[60px] overflow-hidden rounded border border-border bg-bg-base">
          {row.coverImageUrl ? (
            <Image src={row.coverImageUrl} alt="" fill className="object-cover object-top" sizes="60px" />
          ) : (
            <div className="flex h-full items-center justify-center text-[8px] text-text-muted">No cover</div>
          )}
        </div>
        <p className="mt-2 line-clamp-1 text-xs font-semibold text-text-primary">{row.title}</p>
        <p className="line-clamp-1 text-[11px] text-text-muted">{row.author}</p>
        {row.genre ? (
          <span className="mt-1.5 inline-block rounded-full border border-border/80 bg-bg-surface/80 px-2 py-0.5 text-[10px] text-text-secondary">
            {formatGenre(row.genre)}
          </span>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className={`book-row-strip ${stripClassName}`}
        {...pointerHandlers}
      >
        {row.images.map((image, index) => (
          <GalleryRowImageCard
            key={image.id}
            image={image}
            carouselIds={carouselIds}
            index={index}
            variant={variant}
            viewerUserId={viewerUserId}
            isAdmin={isAdmin}
            globalSpoilerProtection={globalSpoilerProtection}
            canLike={canLike}
            likingIds={likingIds}
            onLike={onLike}
            onOpenImage={onOpenImage}
            isCoverFallback={row.isCoverFallback}
            onOpenCoverFallback={onOpenCoverFallback}
          />
        ))}
        {variant === "discovery" ? (
          <InvitationCard
            row={row}
            isLoggedIn={isLoggedIn}
            pending={addLibraryPending}
            onAdd={onAddToLibrary}
            isCoverFallback={row.isCoverFallback}
          />
        ) : null}
      </div>
    </div>
  );
}
