"use client";

import { GalleryCardCornerBadge } from "@/components/gallery/gallery-card-corner-badge";
import { ImageThumbnailBottomBar } from "@/components/image-thumbnail-bottom-bar";
import { GalleryImageComments } from "@/components/gallery/gallery-image-comments";
import {
  GalleryImageModalShell,
  galleryImageModalDialogClassName,
  galleryImageModalDialogHeightClassName,
} from "@/components/gallery/gallery-image-modal-shell";
import { ModalImageNavArrows } from "@/components/gallery/modal-image-nav-arrows";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import { AdminFeaturedImageToggle } from "@/components/gallery/admin-featured-image-toggle";
import { GalleryImagePromptDisclosure } from "@/components/gallery/gallery-image-prompt-disclosure";
import { GallerySpoilerSelect } from "@/components/gallery/gallery-spoiler-select";
import { resolveLibraryPadlockBadge } from "@/lib/gallery-card-spoiler-badge";
import { isTextEntryFocused } from "@/lib/is-text-entry-focused";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SpoilerProtection } from "@db";
import { BookLibraryActions } from "../discover/book-library-actions";

/** Legacy key — cleared on mount so spoiler reveal is never persisted across visits. */
const LEGACY_SESSION_UNLOCK_KEY = "novelviz_session_unlocks";

/** Match main gallery modal — same height as share controls */
const modalViewGalleryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-blue-600/50 bg-blue-600/15 px-3 text-sm font-medium text-blue-200 shadow-sm transition hover:border-blue-500/60 hover:bg-blue-600/25";

type ApiImage = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  userId: string;
  username: string;
  likeCount: number;
  commentCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  likedByViewer: boolean;
  isLocked: boolean;
  bookId: string;
  bookTitle: string;
  author: string;
};

type BookGalleryResponse = {
  images?: ApiImage[];
  currentChapterNumber?: number | null;
};

type Props = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverImageUrl: string | null;
  imageCount: number;
  globalSpoilerProtection: boolean;
  userBookSpoiler: SpoilerProtection | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  viewerUserId: string | null;
  viewerDisplayName: string | null;
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

function formatCardDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function GalleryBookClient({
  bookId,
  bookTitle,
  bookAuthor,
  coverImageUrl,
  imageCount,
  globalSpoilerProtection,
  userBookSpoiler,
  isLoggedIn,
  isAdmin,
  viewerUserId,
  viewerDisplayName,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [images, setImages] = useState<ApiImage[]>([]);
  const [currentChapterNumber, setCurrentChapterNumber] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spoilerSetting, setSpoilerSetting] = useState<SpoilerProtection>(userBookSpoiler ?? "INHERIT");
  const [sessionReveal, setSessionReveal] = useState(false);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [modalSlideDir, setModalSlideDir] = useState<-1 | 0 | 1>(0);
  const [modalSwipeBusy, setModalSwipeBusy] = useState(false);
  const [modalCtaError, setModalCtaError] = useState<string | null>(null);
  const [modalUnlockPending, setModalUnlockPending] = useState(false);
  const [addLibraryPending, setAddLibraryPending] = useState(false);
  const [shareUpdatingIds, setShareUpdatingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userBookSpoiler) setSpoilerSetting(userBookSpoiler);
  }, [userBookSpoiler]);

  useEffect(() => {
    setSessionReveal(false);
    try {
      sessionStorage.removeItem(LEGACY_SESSION_UNLOCK_KEY);
    } catch {
      /* ignore */
    }
  }, [bookId]);

  const fetchImages = useCallback(
    async (sessionParam: boolean) => {
      setLoading(true);
      setLoadError(null);
      try {
        const q = sessionParam ? "?session=true" : "";
        const res = await fetch(`/api/gallery/book/${bookId}${q}`);
        if (!res.ok) {
          setLoadError("Could not load images.");
          setImages([]);
          return;
        }
        const data = (await res.json()) as BookGalleryResponse;
        setImages(
          (data.images ?? []).map((raw) => {
            const img = raw as ApiImage & { likedByViewer?: boolean; commentCount?: number };
            return {
              ...img,
              likedByViewer: img.likedByViewer ?? false,
              isFeatured: img.isFeatured ?? false,
              commentCount: typeof img.commentCount === "number" ? img.commentCount : 0,
            };
          }),
        );
        setCurrentChapterNumber(data.currentChapterNumber ?? null);
      } catch {
        setLoadError("Could not load images.");
        setImages([]);
        setCurrentChapterNumber(null);
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  useEffect(() => {
    void fetchImages(sessionReveal);
  }, [fetchImages, sessionReveal]);

  function displayLocked(image: ApiImage): boolean {
    if (isAdmin) return false;
    if (sessionReveal) return false;
    if (viewerUserId !== null && image.userId === viewerUserId) return false;
    return image.isLocked;
  }

  const canLike = isLoggedIn || isAdmin;

  function canLikeImage(image: ApiImage): boolean {
    if (!canLike) return false;
    if (viewerUserId !== null && image.userId === viewerUserId) return false;
    if (image.likedByViewer) return false;
    if (displayLocked(image)) return false;
    return true;
  }

  async function likeImage(imageId: string) {
    if (likingIds[imageId]) return;
    const prior = images.find((i) => i.id === imageId);
    if (!prior || !canLikeImage(prior)) return;

    const beforeLikeCount = prior.likeCount;
    const beforeLikedByViewer = prior.likedByViewer;

    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImages((prev) =>
      prev.map((img) =>
        img.id !== imageId ? img : { ...img, likeCount: img.likeCount + 1, likedByViewer: true },
      ),
    );
    try {
      const body = sessionReveal
        ? JSON.stringify({ sessionBrowsingUnlockedBookIds: [bookId] })
        : JSON.stringify({});
      const res = await fetch(`/api/gallery/${imageId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        likeCount?: number;
        error?: string;
        code?: string;
      };
      const revertLike = () => {
        setImages((prev) =>
          prev.map((img) =>
            img.id !== imageId
              ? img
              : {
                  ...img,
                  likeCount: beforeLikeCount,
                  likedByViewer: beforeLikedByViewer,
                },
          ),
        );
      };

      if (!res.ok || typeof data.likeCount !== "number") {
        revertLike();
        return;
      }
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, likeCount: data.likeCount!, likedByViewer: true } : img,
        ),
      );
    } catch {
      setImages((prev) =>
        prev.map((img) =>
          img.id !== imageId
            ? img
            : {
                ...img,
                likeCount: beforeLikeCount,
                likedByViewer: beforeLikedByViewer,
              },
        ),
      );
    } finally {
      setLikingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  const modalImage = modalIndex !== null ? images[modalIndex] : null;
  const modalLocked = modalImage ? displayLocked(modalImage) : false;
  const chapterGap =
    modalLocked && modalImage
      ? Math.max(1, modalImage.chapterNumberAtTime - (currentChapterNumber ?? 0))
      : null;

  function openModalAtGridIndex(index: number) {
    setModalSlideDir(0);
    setModalSwipeBusy(false);
    setModalIndex(index);
  }

  function dismissModalImage() {
    setModalIndex(null);
    setModalSlideDir(0);
    setModalSwipeBusy(false);
  }

  const bumpModalIndex = useCallback(
    (delta: number) => {
      if (modalIndex === null || modalSwipeBusy) return;
      const nextIndex = modalIndex + delta;
      if (nextIndex < 0 || nextIndex >= images.length) return;
      setModalSlideDir(delta > 0 ? 1 : -1);
      setModalIndex(nextIndex);
    },
    [modalIndex, modalSwipeBusy, images.length],
  );

  const bookInLibrary = isLoggedIn && userBookSpoiler !== null;

  function handleSpoilerVisibilityChange(next: "show" | "hide") {
    const wantsShow = next === "show";
    if (wantsShow === sessionReveal) return;
    setSessionReveal(wantsShow);
  }

  const from = searchParams.get("from");
  const backHref = from === "reader" || from === "library" ? `/library?book=${bookId}` : "/gallery";
  const backLabel = from === "reader" ? "Back to your book" : "Back to public gallery";

  useEffect(() => {
    setModalCtaError(null);
  }, [modalIndex]);

  async function unlockBookSpoilers() {
    setModalCtaError(null);
    setModalUnlockPending(true);
    try {
      const res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: "UNLOCKED" }),
      });

      const readErr = async () => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? null;

      if (res.ok) {
        dismissModalImage();
        router.refresh();
        await fetchImages(sessionReveal);
        return;
      }

      if (res.status === 404) {
        const create = await fetch(`/api/library/${bookId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spoilerProtection: "UNLOCKED" }),
        });
        const payload = await create.json().catch(() => ({}));
        if (create.ok) {
          dismissModalImage();
          router.refresh();
          await fetchImages(sessionReveal);
          return;
        }
        const rawCreateErr = (payload as { error?: string }).error;
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

  async function addBookFromGalleryModal(then: "reader" | "stay") {
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
      dismissModalImage();
      if (then === "reader") router.push(`/library?book=${bookId}`);
      else router.refresh();
    } finally {
      setAddLibraryPending(false);
    }
  }

  async function setImagePublicState(imageId: string, isPublic: boolean) {
    if (!imageId || shareUpdatingIds[imageId]) return;
    const prior = images.find((i) => i.id === imageId);
    if (!prior) return;

    setShareUpdatingIds((prev) => ({ ...prev, [imageId]: true }));
    setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, isPublic } : img)));
    try {
      const res = await fetch(`/api/gallery/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: { isPublic?: boolean } };
      if (!res.ok || typeof data.image?.isPublic !== "boolean") {
        setImages((prev) => prev.map((img) => (img.id === imageId ? prior : img)));
        return;
      }
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, isPublic: data.image!.isPublic! } : img,
        ),
      );
    } catch {
      setImages((prev) => prev.map((img) => (img.id === imageId ? prior : img)));
    } finally {
      setShareUpdatingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  useEffect(() => {
    if (modalIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissModalImage();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTextEntryFocused()) return;
      e.preventDefault();
      if (modalSwipeBusy) return;
      const delta = e.key === "ArrowRight" ? 1 : -1;
      bumpModalIndex(delta);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalIndex, modalSwipeBusy, bumpModalIndex]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
      <header className="border-b border-border/80 pb-3">
        <Link
          href={backHref}
          className="mb-2 inline-block text-xs font-medium text-accent-text underline-offset-2 hover:underline"
        >
          ← {backLabel}
        </Link>

        <div className="flex items-start gap-3">
          <div className="relative h-14 w-[2.35rem] shrink-0 overflow-hidden rounded border border-border bg-bg-base">
            {coverImageUrl ? (
              <Image
                src={coverImageUrl}
                alt=""
                fill
                className="object-cover object-top"
                sizes="42px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[8px] text-text-muted">
                No cover
              </div>
            )}
          </div>

          <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <h1 className="max-w-full truncate font-serif text-base font-semibold leading-tight text-text-primary sm:text-lg">
                {bookTitle}
              </h1>
              <span className="text-text-muted/70" aria-hidden>
                ·
              </span>
              <p className="truncate text-xs text-text-secondary">{bookAuthor}</p>
              <span className="text-text-muted/70" aria-hidden>
                ·
              </span>
              <p className="shrink-0 text-xs text-text-muted">
                {imageCount} public {imageCount === 1 ? "image" : "images"}
                {loading ? " · …" : null}
              </p>
            </div>

            {isLoggedIn && bookInLibrary && !isAdmin ? (
              <GallerySpoilerSelect
                className="w-fit"
                value={sessionReveal ? "show" : "hide"}
                onChange={(value) => handleSpoilerVisibilityChange(value)}
              />
            ) : null}

            {isLoggedIn && !bookInLibrary ? (
              <BookLibraryActions
                bookId={bookId}
                initialInLibrary={false}
                isLoggedIn
              />
            ) : null}
          </div>
        </div>
      </header>

      {loadError ? <p className="mt-3 text-sm text-error">{loadError}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {images.map((image, index) => {
          const locked = displayLocked(image);
          const username = image.username?.trim() || "Anonymous reader";
          const alreadyLiked = image.likedByViewer;
          const likeAllowed = canLikeImage(image);
          const likeDisabled = !likeAllowed || !!likingIds[image.id];
          const isOwnImage = viewerUserId !== null && viewerUserId === image.userId;
          const padlockVariant = sessionReveal
            ? (viewerUserId !== null && image.userId === viewerUserId ? "aqua" : null)
            : resolveLibraryPadlockBadge({
                viewerUserId,
                isAdmin,
                globalSpoilerProtection,
                bookSpoilerSetting: spoilerSetting,
                imageUserId: image.userId,
                imageChapter: image.chapterNumberAtTime,
                currentChapter: currentChapterNumber ?? undefined,
                locked,
              });

          return (
            <article key={image.id} className="group">
              <div className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-bg-base text-left shadow-sm outline-none transition hover:border-border-subtle focus-visible:ring-2 focus-visible:ring-accent/40"
                  onClick={() => openModalAtGridIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openModalAtGridIndex(index);
                    }
                  }}
                >
                  <Image
                    src={image.imageUrl}
                    alt={image.userPrompt}
                    fill
                    unoptimized
                    className={`object-cover transition-[filter] duration-200 ${locked ? "blur-[24px]" : "blur-0"}`}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  {!locked && padlockVariant ? (
                    <GalleryCardCornerBadge kind="library-padlock" variant={padlockVariant} />
                  ) : null}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[28%] bg-gradient-to-b from-black/42 to-transparent"
                    aria-hidden
                  />
                  <ImageThumbnailBottomBar />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 pt-8">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0 flex-1 pr-1">
                        <p className="text-xs font-medium text-text-muted">Chapter {image.chapterNumberAtTime}</p>
                        <p className="mt-0.5 text-[11px] text-text-secondary line-clamp-1">{username}</p>
                      </div>
                      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                        <span
                          className="pointer-events-none inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-primary shadow-sm"
                          title={`${image.commentCount} comment${image.commentCount === 1 ? "" : "s"}`}
                        >
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span>{image.commentCount}</span>
                        </span>
                        {isOwnImage ? (
                          <span
                            title="You created this"
                            className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-muted shadow-sm"
                          >
                            <HeartIcon className="h-3.5 w-3.5" />
                            <span>{image.likeCount}</span>
                          </span>
                        ) : locked ? (
                          <span
                            title={alreadyLiked ? "You liked this — unlock the image to interact" : "Unlock to like"}
                            className="inline-flex cursor-default items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-muted shadow-sm"
                          >
                            <HeartIcon filled={alreadyLiked} className={`h-3.5 w-3.5 shrink-0 ${alreadyLiked ? "text-red-500/80" : ""}`} />
                            <span>{image.likeCount}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={likeDisabled}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void likeImage(image.id);
                            }}
                            className={`inline-flex items-center gap-1 rounded-md border bg-bg-surface/90 px-2 py-1 text-xs font-medium shadow-sm transition hover:bg-bg-raised disabled:cursor-not-allowed ${
                              alreadyLiked
                                ? "opacity-100 disabled:opacity-100"
                                : "disabled:opacity-50"
                            } ${alreadyLiked ? "border-red-500/55 text-red-500" : "border-border/80 text-text-primary"}`}
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
                  </div>
                  {locked ? (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg-overlay/45 px-2 text-center">
                      <LockIcon className="h-8 w-8 text-accent-text/95" />
                      <p className="text-xs font-medium text-text-primary">Chapter {image.chapterNumberAtTime}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {modalImage ? (
        <GalleryImageModalShell onClose={dismissModalImage}>
          <div
            role="dialog"
            aria-modal="true"
            className={`${galleryImageModalDialogClassName} ${galleryImageModalDialogHeightClassName}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary transition hover:bg-bg-raised"
              onClick={() => dismissModalImage()}
              aria-label="Close modal"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden max-md:flex-col md:flex-row sm:pt-1">
              <div
                className={`flex min-h-0 min-w-0 flex-col max-md:max-h-[50dvh] max-md:flex-none ${modalLocked ? "w-full" : "md:flex-[2] md:border-r md:border-border"}`}
              >
              <div className="relative flex min-h-[200px] flex-1 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">
                <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
                  <ModalImageSwipeView
                    slide={{
                      id: modalImage.id,
                      imageUrl: modalImage.imageUrl,
                      userPrompt: modalImage.userPrompt,
                      locked: modalLocked,
                    }}
                    direction={modalSlideDir}
                    onDirectionConsumed={() => setModalSlideDir(0)}
                    onAnimatingChange={setModalSwipeBusy}
                    sizes="(max-width: 1024px) 66vw, 640px"
                  />
                  {modalIndex !== null && images.length > 1 ? (
                    <ModalImageNavArrows
                      show
                      canPrev={modalIndex > 0 && !modalSwipeBusy}
                      canNext={modalIndex < images.length - 1 && !modalSwipeBusy}
                      onPrev={() => bumpModalIndex(-1)}
                      onNext={() => bumpModalIndex(1)}
                    />
                  ) : null}
                </div>
              </div>

                <div className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
                  <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="min-w-0 flex-1 text-lg font-semibold text-text-primary">{modalImage.bookTitle}</h2>
                    <p className="shrink-0 text-sm text-text-muted">Generated at Chapter {modalImage.chapterNumberAtTime}</p>
                  </div>
                  {!modalLocked ? (
                    <GalleryImagePromptDisclosure prompt={modalImage.userPrompt} />
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                      {viewerUserId !== null && modalImage.userId === viewerUserId ? (
                        <span
                          title="You created this"
                          className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted"
                        >
                          <HeartIcon className="h-4 w-4 shrink-0" />
                          <span>{modalImage.likeCount}</span>
                        </span>
                      ) : modalLocked ? (
                        <span
                          title={
                            modalImage.likedByViewer
                              ? "You liked this — unlock the image to interact"
                              : "Unlock to like"
                          }
                          className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted"
                        >
                          <HeartIcon
                            filled={modalImage.likedByViewer}
                            className={`h-4 w-4 shrink-0 ${modalImage.likedByViewer ? "text-red-500/80" : ""}`}
                          />
                          <span>{modalImage.likeCount}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void likeImage(modalImage.id)}
                          disabled={!likeAllowed || !!likingIds[modalImage.id]}
                          className={`inline-flex items-center gap-2 rounded-md border bg-bg-surface px-3 py-2 text-sm font-medium transition hover:bg-bg-raised disabled:cursor-not-allowed ${
                            modalImage.likedByViewer
                              ? "opacity-100 disabled:opacity-100"
                              : "disabled:opacity-60"
                          } ${modalImage.likedByViewer ? "border-red-500/55 text-red-500" : "border-border text-text-primary"}`}
                          aria-label={
                            modalImage.likedByViewer
                              ? `You liked this (${modalImage.likeCount})`
                              : "Like this image"
                          }
                        >
                          <HeartIcon filled={modalImage.likedByViewer} className={`h-4 w-4 shrink-0 ${modalImage.likedByViewer ? "text-red-500" : ""}`} />
                          <span>{modalImage.likeCount}</span>
                        </button>
                      )}
                      {viewerUserId !== null && modalImage.userId === viewerUserId ? (
                        <button
                          type="button"
                          onClick={() => void setImagePublicState(modalImage.id, !modalImage.isPublic)}
                          disabled={!!shareUpdatingIds[modalImage.id]}
                          className={`inline-flex h-9 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                            modalImage.isPublic
                              ? "border-error/35 bg-error/10 text-error"
                              : "border-success/35 bg-success/10 text-success"
                          }`}
                        >
                          {shareUpdatingIds[modalImage.id]
                            ? "Saving…"
                            : modalImage.isPublic
                              ? "Make private"
                              : "Make public"}
                        </button>
                      ) : null}
                      <AdminFeaturedImageToggle
                        show={isAdmin}
                        imageId={modalImage.id}
                        isFeatured={modalImage.isFeatured}
                        onFeaturedChange={(next) => {
                          setImages((prev) =>
                            prev.map((img) =>
                              img.id === modalImage.id ? { ...img, isFeatured: next } : img,
                            ),
                          );
                        }}
                      />
                      <Link
                        href={`/gallery/${modalImage.bookId}?from=gallery`}
                        onClick={() => dismissModalImage()}
                        className={modalViewGalleryButtonClass}
                      >
                        View Public Gallery
                      </Link>
                    </div>
                    <div className="text-sm text-text-muted shrink-0">
                      <span>{modalImage.username?.trim() || "Anonymous reader"}</span>
                      {viewerUserId !== null && modalImage.userId === viewerUserId ? (
                        <span className="ml-2 inline-flex rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                          Your image
                        </span>
                      ) : null}
                      <span className="mx-2 text-text-secondary/80" aria-hidden>
                        •
                      </span>
                      <span>{formatCardDate(modalImage.createdAt)}</span>
                    </div>
                  </div>
                  {modalLocked ? (
                    <div className="space-y-3 rounded-lg border border-border/90 bg-bg-base/60 p-3">
                      {modalCtaError ? <p className="text-sm text-error">{modalCtaError}</p> : null}
                      {!isLoggedIn ? (
                        <p className="text-sm text-text-secondary">
                          Sign in to track reading progress and unlock gallery images tied to your library books.
                        </p>
                      ) : isLoggedIn && !isAdmin && !bookInLibrary ? (
                        <>
                          <p className="text-sm text-text-secondary">
                            Add this book to your library to track your progress
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={addLibraryPending}
                              onClick={() => void addBookFromGalleryModal("reader")}
                              className="inline-flex items-center rounded-md border border-accent/40 bg-accent-muted px-3 py-2 text-sm font-semibold text-text-primary ring-1 ring-accent/45 transition hover:bg-accent-hover/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add to Library &amp; Start Reading
                            </button>
                            <button
                              type="button"
                              disabled={addLibraryPending}
                              onClick={() => void addBookFromGalleryModal("stay")}
                              className="text-sm font-medium text-accent-text underline-offset-2 transition hover:underline disabled:opacity-50"
                            >
                              Add to Library only
                            </button>
                          </div>
                        </>
                      ) : isLoggedIn && bookInLibrary ? (
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
                              onClick={() => void unlockBookSpoilers()}
                              className="inline-flex items-center rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-success transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Unlock all {modalImage.bookTitle} images
                            </button>
                            <Link
                              href={`/library?book=${modalImage.bookId}`}
                              onClick={() => dismissModalImage()}
                              className="text-sm font-medium text-accent-text underline-offset-2 transition hover:underline"
                            >
                              Continue reading →
                            </Link>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              </div>

              {!modalLocked ? (
                <aside className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-bg-surface/40 max-md:border-r-0 md:border-t-0">
                  <GalleryImageComments
                      layout="sidebar"
                      className="h-full min-h-0"
                      imageId={modalImage.id}
                      sessionCommentsUnlocked={sessionReveal}
                      isLoggedIn={isLoggedIn}
                      canInteract={!modalLocked}
                      viewerDisplayName={viewerDisplayName}
                      onPostedVisibleComment={() => {
                        const mid = modalImage.id;
                        setImages((prev) =>
                          prev.map((img) =>
                            img.id === mid ? { ...img, commentCount: (img.commentCount ?? 0) + 1 } : img,
                          ),
                        );
                      }}
                    />
                </aside>
              ) : null}
            </div>
          </div>
        </GalleryImageModalShell>
      ) : null}
    </div>
  );
}
