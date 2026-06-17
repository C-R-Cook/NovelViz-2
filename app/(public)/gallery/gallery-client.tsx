"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./gallery-redesign.css";
import { GalleryBookRow } from "@/components/gallery/gallery-book-row";
import { GalleryGenrePills } from "@/components/gallery/gallery-genre-pills";
import { GalleryImageComments } from "@/components/gallery/gallery-image-comments";
import { AdminFeaturedImageToggle } from "@/components/gallery/admin-featured-image-toggle";
import { GalleryImagePromptDisclosure } from "@/components/gallery/gallery-image-prompt-disclosure";
import {
  GalleryImageModalShell,
  galleryImageModalDialogClassName,
  galleryImageModalDialogHeightClassName,
} from "@/components/gallery/gallery-image-modal-shell";
import { ModalImageNavArrows } from "@/components/gallery/modal-image-nav-arrows";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import { GallerySpoilerSelect } from "@/components/gallery/gallery-spoiler-select";
import {
  isGalleryCoverFallbackImageId,
  type BookGalleryRow,
  type GalleryClientSessionProps,
  type GalleryDiscoveryMode,
  type GalleryImageCard,
  type GalleryPageApiResponse,
} from "@/lib/gallery-types";
import { isTextEntryFocused } from "@/lib/is-text-entry-focused";
import { HelpCircle, LockKeyholeOpen, Star } from "lucide-react";
import type { SpoilerProtection } from "@db";

export type { GalleryImageCard, GalleryLockKind } from "@/lib/gallery-types";

const modalViewGalleryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-blue-600/50 bg-blue-600/15 px-3 text-sm font-medium text-blue-200 shadow-sm transition hover:border-blue-500/60 hover:bg-blue-600/25";

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
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isGalleryImageLockedForViewer(image: GalleryImageCard, isAdmin: boolean): boolean {
  if (isAdmin) return false;
  return image.isLocked;
}

function GallerySectionLabel({
  label,
  right,
}: {
  label: string;
  right?: ReactNode;
}) {
  return (
    <div className="gallery-section-label-row">
      <div className="gallery-section-label-text">
        <span className="gallery-section-label">{label}</span>
      </div>
      <div className="gallery-section-label-line" aria-hidden />
      {right ? <span className="gallery-section-label-right">{right}</span> : null}
    </div>
  );
}

function GallerySectionDivider() {
  return (
    <div className="gallery-section-divider" aria-hidden>
      <div className="gallery-divider-line" />
      <span className="gallery-divider-gem">✦</span>
      <div className="gallery-divider-line" />
    </div>
  );
}

function imagesByIdFromRows(
  libraryRows: BookGalleryRow[],
  discoveryRows: BookGalleryRow[],
): Record<string, GalleryImageCard> {
  const map = new Map<string, GalleryImageCard>();
  for (const row of [...libraryRows, ...discoveryRows]) {
    for (const img of row.images) map.set(img.id, img);
  }
  return Object.fromEntries(map.entries());
}

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
      commentCount: typeof s.commentCount === "number" ? s.commentCount : (p?.commentCount ?? 0),
    };
  }
  return next;
}

function useGalleryMotionPrefs() {
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

export function GalleryClient(props: GalleryClientSessionProps) {
  const router = useRouter();
  const { finePointer, reducedMotion } = useGalleryMotionPrefs();
  const modalOpenBlockUntilRef = useRef(0);

  const [libraryRows, setLibraryRows] = useState<BookGalleryRow[]>([]);
  const [discoveryRows, setDiscoveryRows] = useState<BookGalleryRow[]>([]);
  const [discoveryMode, setDiscoveryMode] = useState<GalleryDiscoveryMode>("community");
  const [libraryMeta, setLibraryMeta] = useState({
    hasLibraryBooks: false,
    hasVisibleLibraryImages: false,
  });
  const [apiGenrePreferences, setApiGenrePreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const [imagesById, setImagesById] = useState<Record<string, GalleryImageCard>>({});
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<{ carouselIds: string[]; index: number } | null>(null);
  const [modalSlideDir, setModalSlideDir] = useState<-1 | 0 | 1>(0);
  const [modalSwipeBusy, setModalSwipeBusy] = useState(false);
  const [modalCtaError, setModalCtaError] = useState<string | null>(null);
  const [modalUnlockPending, setModalUnlockPending] = useState(false);
  const [addLibraryPending, setAddLibraryPending] = useState(false);
  const [shareUpdatingIds, setShareUpdatingIds] = useState<Record<string, boolean>>({});
  const [legendOpen, setLegendOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [gallerySessionRevealAll, setGallerySessionRevealAll] = useState(false);
  const [invitationPendingBookId, setInvitationPendingBookId] = useState<string | null>(null);

  const canLike = props.isLoggedIn || props.isAdmin;
  const badgeGlobalSpoiler = props.isAdmin
    ? props.globalSpoilerProtection
    : gallerySessionRevealAll
      ? false
      : props.globalSpoilerProtection;

  const fetchGallery = useCallback(async (sessionReveal: boolean) => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = sessionReveal && props.isLoggedIn && !props.isAdmin ? "?session=true" : "";
      const res = await fetch(`/api/gallery${q}`);
      if (!res.ok) {
        setLoadError("Could not load gallery.");
        return;
      }
      const data = (await res.json()) as GalleryPageApiResponse;
      setLibraryRows(data.libraryRows ?? []);
      setDiscoveryRows(data.discoveryRows ?? []);
      setDiscoveryMode(data.discoveryMode ?? "community");
      setLibraryMeta(data.libraryMeta ?? { hasLibraryBooks: false, hasVisibleLibraryImages: false });
      setApiGenrePreferences(data.userGenrePreferences ?? []);
      setImagesById((prev) =>
        mergeGalleryServerImages(
          imagesByIdFromRows(data.libraryRows ?? [], data.discoveryRows ?? []),
          prev,
        ),
      );
    } catch {
      setLoadError("Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }, [props.isAdmin, props.isLoggedIn]);

  useEffect(() => {
    setGallerySessionRevealAll(false);
    try {
      sessionStorage.removeItem("novelviz_session_unlocks");
      if (sessionStorage.getItem("novelviz:gallery-scroll-top") === "1") {
        sessionStorage.removeItem("novelviz:gallery-scroll-top");
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchGallery(gallerySessionRevealAll);
  }, [fetchGallery, gallerySessionRevealAll]);

  useEffect(() => {
    if (reducedMotion) {
      setHeaderVisible(true);
      return;
    }
    const t = window.setTimeout(() => setHeaderVisible(true), 100);
    return () => window.clearTimeout(t);
  }, [reducedMotion]);

  const filterRow = useCallback(
    (row: BookGalleryRow) => {
      if (!selectedGenre) return true;
      return row.genre === selectedGenre;
    },
    [selectedGenre],
  );

  const filteredLibraryRows = useMemo(
    () => libraryRows.filter(filterRow),
    [libraryRows, filterRow],
  );
  const filteredDiscoveryRows = useMemo(
    () => discoveryRows.filter(filterRow),
    [discoveryRows, filterRow],
  );

  const allGenreValues = useMemo(() => {
    const set = new Set<string>([...apiGenrePreferences, ...props.genrePreferences]);
    for (const row of [...libraryRows, ...discoveryRows]) {
      if (row.genre) set.add(row.genre);
    }
    return [...set];
  }, [libraryRows, discoveryRows, apiGenrePreferences, props.genrePreferences]);

  const modalCarouselIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of [...filteredLibraryRows, ...filteredDiscoveryRows]) {
      for (const img of row.images) {
        if (isGalleryImageLockedForViewer(img, props.isAdmin)) continue;
        if (isGalleryCoverFallbackImageId(img.id)) continue;
        if (seen.has(img.id)) continue;
        seen.add(img.id);
        ids.push(img.id);
      }
    }
    return ids;
  }, [filteredLibraryRows, filteredDiscoveryRows, props.isAdmin]);

  const libraryImageCount = useMemo(
    () => filteredLibraryRows.reduce((n, row) => n + row.images.length, 0),
    [filteredLibraryRows],
  );

  /** First visible gallery card — Next.js LCP candidate on /gallery. */
  const firstLcpBookId = useMemo(() => {
    for (const row of [...filteredLibraryRows, ...filteredDiscoveryRows]) {
      if (row.images.length > 0) return row.bookId;
    }
    return null;
  }, [filteredLibraryRows, filteredDiscoveryRows]);

  function canLikeImage(image: GalleryImageCard): boolean {
    if (isGalleryCoverFallbackImageId(image.id)) return false;
    if (!canLike) return false;
    if (props.viewerUserId && image.userId === props.viewerUserId) return false;
    if (image.likedByViewer) return false;
    if (isGalleryImageLockedForViewer(image, props.isAdmin)) return false;
    return true;
  }

  async function likeImage(imageId: string) {
    if (isGalleryCoverFallbackImageId(imageId)) return;
    if (likingIds[imageId]) return;
    const prior = imagesById[imageId];
    if (!prior || !canLikeImage(prior)) return;

    const beforeLikeCount = prior.likeCount;
    const beforeLikedByViewer = prior.likedByViewer;
    const sessionBrowsingUnlockedBookIds =
      gallerySessionRevealAll && prior.bookId ? [prior.bookId] : [];

    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImagesById((prev) => {
      const img = prev[imageId];
      if (!img || !canLikeImage(img)) return prev;
      return { ...prev, [imageId]: { ...img, likeCount: img.likeCount + 1, likedByViewer: true } };
    });

    try {
      const res = await fetch(`/api/gallery/${imageId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionBrowsingUnlockedBookIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { likeCount?: number };

      const revert = () => {
        setImagesById((prev) => ({
          ...prev,
          [imageId]: { ...prev[imageId]!, likeCount: beforeLikeCount, likedByViewer: beforeLikedByViewer },
        }));
      };

      if (!res.ok || typeof data.likeCount !== "number") {
        revert();
        return;
      }
      setImagesById((prev) => ({
        ...prev,
        [imageId]: { ...prev[imageId]!, likeCount: data.likeCount!, likedByViewer: true },
      }));
    } catch {
      setImagesById((prev) => ({
        ...prev,
        [imageId]: { ...prev[imageId]!, likeCount: beforeLikeCount, likedByViewer: beforeLikedByViewer },
      }));
    } finally {
      setLikingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  function openModal(carouselIds: string[], index: number) {
    if (Date.now() < modalOpenBlockUntilRef.current) return;
    setModalSlideDir(0);
    setModalState({ carouselIds, index });
  }

  const scheduleModalOpenBlockAfterDrag = useCallback(() => {
    modalOpenBlockUntilRef.current = Date.now() + 450;
  }, []);

  function closeModal() {
    setModalState(null);
    setModalCtaError(null);
    setModalSlideDir(0);
    setModalSwipeBusy(false);
  }

  const bumpModalCarousel = useCallback(
    (delta: number) => {
      if (!modalState || modalSwipeBusy) return;
      const nextIndex = modalState.index + delta;
      if (nextIndex < 0 || nextIndex >= modalState.carouselIds.length) return;
      setModalSlideDir(delta > 0 ? 1 : -1);
      setModalState({ ...modalState, index: nextIndex });
    },
    [modalState, modalSwipeBusy],
  );

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
      if (isTextEntryFocused()) return;
      e.preventDefault();
      if (modalSwipeBusy) return;
      bumpModalCarousel(e.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalState, modalSwipeBusy, bumpModalCarousel]);

  const modalLocked = modalActiveImage
    ? isGalleryImageLockedForViewer(modalActiveImage, props.isAdmin)
    : false;
  const chapterGap =
    modalActiveImage && modalLocked
      ? Math.max(1, modalActiveImage.chapterNumberAtTime - (modalActiveImage.currentChapterNumber ?? 0))
      : null;
  const bookInLibrary =
    modalActiveImage && props.libraryBookIds.includes(modalActiveImage.bookId);

  async function unlockBookSpoilers(bookId: string) {
    setModalCtaError(null);
    setModalUnlockPending(true);
    try {
      const res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: "UNLOCKED" }),
      });
      if (res.ok) {
        closeModal();
        await fetchGallery(gallerySessionRevealAll);
        router.refresh();
        return;
      }
      if (res.status === 404) {
        const create = await fetch(`/api/library/${bookId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spoilerProtection: "UNLOCKED" }),
        });
        if (create.ok) {
          closeModal();
          await fetchGallery(gallerySessionRevealAll);
          router.refresh();
          return;
        }
      }
      setModalCtaError("Could not unlock spoilers.");
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
      await fetchGallery(gallerySessionRevealAll);
      router.refresh();
      if (then === "reader") router.push(`/library?book=${bookId}`);
    } finally {
      setAddLibraryPending(false);
    }
  }

  async function addBookFromInvitation(bookId: string) {
    setInvitationPendingBookId(bookId);
    try {
      const res = await fetch(`/api/library/${bookId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoilerProtection: "PROTECTED" }),
      });
      if (res.ok) {
        await fetchGallery(gallerySessionRevealAll);
        router.refresh();
      }
    } finally {
      setInvitationPendingBookId(null);
    }
  }

  async function setImagePublicState(imageId: string, isPublic: boolean) {
    if (!imageId || shareUpdatingIds[imageId]) return;
    const prior = imagesById[imageId];
    if (!prior) return;
    setShareUpdatingIds((prev) => ({ ...prev, [imageId]: true }));
    setImagesById((prev) => ({ ...prev, [imageId]: { ...prev[imageId]!, isPublic } }));
    try {
      const res = await fetch(`/api/gallery/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: { isPublic?: boolean } };
      if (!res.ok || typeof data.image?.isPublic !== "boolean") {
        setImagesById((prev) => ({ ...prev, [imageId]: prior }));
        return;
      }
      setImagesById((prev) => ({
        ...prev,
        [imageId]: { ...prev[imageId]!, isPublic: data.image!.isPublic! },
      }));
    } catch {
      setImagesById((prev) => ({ ...prev, [imageId]: prior }));
    } finally {
      setShareUpdatingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  const openCoverFallbackBook = useCallback(
    (bookId: string) => {
      router.push(`/discover/${bookId}?from=gallery`);
    },
    [router],
  );

  const openBookGallery = useCallback(
    (bookId: string) => {
      router.push(`/gallery/${bookId}?from=gallery`);
    },
    [router],
  );

  const enableDragScroll = finePointer && !reducedMotion;
  const showGlobalEmpty =
    !loading &&
    filteredLibraryRows.length === 0 &&
    filteredDiscoveryRows.length === 0 &&
    !loadError;

  return (
    <div className="gallery-root text-text-primary">
      <div className="gallery-root-inner">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          <header className="flex flex-wrap items-start justify-between gap-4 gap-y-2">
            <div className="min-w-0">
              <p className={`gallery-eyebrow ${headerVisible ? "gallery-concept-hero-in" : "opacity-0 translate-y-2"}`}>
                Reader Community
              </p>
              <h1
                className={`gallery-title tracking-tight text-2xl sm:text-3xl ${headerVisible ? "gallery-concept-hero-in gallery-concept-hero-in--delay" : "opacity-0 translate-y-3"}`}
              >
                Public Gallery
              </h1>
              <p
                className={`gallery-subtitle mt-2 ${headerVisible ? "gallery-concept-hero-in gallery-concept-hero-in--delay2" : "opacity-0 translate-y-3"}`}
              >
                Images created by readers, chapter by chapter
              </p>
            </div>
            {props.isLoggedIn ? (
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <BadgeLegend legendOpen={legendOpen} setLegendOpen={setLegendOpen} />
                {!props.isAdmin ? (
                  <GallerySpoilerSelect
                    value={gallerySessionRevealAll ? "show" : "hide"}
                    onChange={(value) => setGallerySessionRevealAll(value === "show")}
                    className="w-fit"
                  />
                ) : null}
              </div>
            ) : null}
          </header>

          {!props.isLoggedIn ? (
            <div className="gallery-guest-banner mt-6">
              <p className="text-sm text-text-secondary">
                Sign in to see images from your own library and track your reading progress.{" "}
                <Link href="/login" className="font-medium text-accent-text underline-offset-2 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          ) : null}

          <GalleryGenrePills genres={allGenreValues} selected={selectedGenre} onSelect={setSelectedGenre} />

          {loadError ? <p className="mt-6 text-sm text-error">{loadError}</p> : null}

          {loading && !loadError ? (
            <p className="mt-8 text-sm text-text-muted">Loading gallery…</p>
          ) : null}

          {!loading && !loadError ? (
            <div className="mt-8 space-y-10">
              {props.isLoggedIn ? (
                <section className="space-y-4">
                  <GallerySectionLabel
                    label="FROM YOUR LIBRARY"
                    right={libraryImageCount > 0 ? `${libraryImageCount} images` : undefined}
                  />
                  {!libraryMeta.hasLibraryBooks ? (
                    <div className="gallery-empty-state">
                      <p className="text-sm text-text-secondary">
                        Add books to your library to see images here.
                      </p>
                      <div className="mt-4">
                        <Link href="/discover" className="gallery-empty-state-cta">
                          Discover Books
                        </Link>
                      </div>
                    </div>
                  ) : !libraryMeta.hasVisibleLibraryImages ? (
                    <p className="gallery-empty-state text-sm text-text-secondary">
                      No community images yet from your library books. Check back soon, or explore the
                      discover section below.
                    </p>
                  ) : filteredLibraryRows.length === 0 && selectedGenre ? (
                    <p className="text-sm text-text-muted">No library books match this genre.</p>
                  ) : (
                    <div className="space-y-6">
                      {filteredLibraryRows.map((row) => (
                        <GalleryBookRow
                          key={row.bookId}
                          row={row}
                          variant="library"
                          priorityFirstImage={row.bookId === firstLcpBookId}
                          carouselIds={modalCarouselIds}
                          viewerUserId={props.viewerUserId}
                          isAdmin={props.isAdmin}
                          globalSpoilerProtection={badgeGlobalSpoiler}
                          spoilerSetting={props.spoilerSettingsByBookId[row.bookId] ?? "INHERIT"}
                          canLike={canLike}
                          likingIds={likingIds}
                          onLike={likeImage}
                          onOpenImage={openModal}
                          onDragMoved={scheduleModalOpenBlockAfterDrag}
                          enableDragScroll={enableDragScroll}
                          isLoggedIn={props.isLoggedIn}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {props.isLoggedIn && filteredLibraryRows.length > 0 && filteredDiscoveryRows.length > 0 ? (
                <GallerySectionDivider />
              ) : null}

              <section className="space-y-4">
                <GallerySectionLabel
                  label="DISCOVER"
                  right={
                    filteredDiscoveryRows.length > 0
                      ? `${filteredDiscoveryRows.length} book${filteredDiscoveryRows.length === 1 ? "" : "s"}`
                      : undefined
                  }
                />
                {discoveryMode === "cover-fallback" && filteredDiscoveryRows.length > 0 && !selectedGenre ? (
                  <p className="text-xs text-text-muted">
                    Community gallery images are sparse — showing AI-generated covers from our catalogue.
                  </p>
                ) : null}
                {filteredDiscoveryRows.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    {selectedGenre ? "No discover books match this genre." : "Nothing to discover yet."}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {filteredDiscoveryRows.map((row) => (
                      <GalleryBookRow
                        key={row.bookId}
                        row={row}
                        variant="discovery"
                        priorityFirstImage={row.bookId === firstLcpBookId}
                        carouselIds={modalCarouselIds}
                        viewerUserId={props.viewerUserId}
                        isAdmin={props.isAdmin}
                        globalSpoilerProtection={badgeGlobalSpoiler}
                        spoilerSetting="INHERIT"
                        canLike={canLike}
                        likingIds={likingIds}
                        onLike={likeImage}
                        onOpenImage={openModal}
                        onDragMoved={scheduleModalOpenBlockAfterDrag}
                        enableDragScroll={enableDragScroll}
                        isLoggedIn={props.isLoggedIn}
                        onAddToLibrary={addBookFromInvitation}
                        addLibraryPending={invitationPendingBookId === row.bookId}
                        onOpenCoverFallback={openCoverFallbackBook}
                        onOpenBookGallery={openBookGallery}
                      />
                    ))}
                  </div>
                )}
              </section>

              {showGlobalEmpty ? (
                <p className="gallery-empty-state text-center text-sm text-text-secondary">
                  The gallery is just getting started. Generate your first image from any book in your library.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {modalState && modalActiveImage ? (
        <GalleryImageModalShell onClose={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            className={`${galleryImageModalDialogClassName} ${galleryImageModalDialogHeightClassName}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary transition hover:bg-bg-raised"
              onClick={closeModal}
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
                        id: modalActiveImage.id,
                        imageUrl: modalActiveImage.imageUrl,
                        userPrompt: modalActiveImage.userPrompt,
                        locked: modalLocked,
                      }}
                      direction={modalSlideDir}
                      onDirectionConsumed={() => setModalSlideDir(0)}
                      onAnimatingChange={setModalSwipeBusy}
                      sizes="(max-width: 1024px) 66vw, 640px"
                    />
                    {modalState.carouselIds.length > 1 ? (
                      <ModalImageNavArrows
                        show
                        canPrev={modalState.index > 0 && !modalSwipeBusy}
                        canNext={modalState.index < modalState.carouselIds.length - 1 && !modalSwipeBusy}
                        onPrev={() => bumpModalCarousel(-1)}
                        onNext={() => bumpModalCarousel(1)}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="min-w-0 flex-1 text-lg font-semibold text-text-primary">
                        {modalActiveImage.bookTitle}
                      </h2>
                      <p className="shrink-0 text-sm text-text-muted">
                        Generated at Chapter {modalActiveImage.chapterNumberAtTime}
                      </p>
                    </div>

                    {!modalLocked ? (
                      <GalleryImagePromptDisclosure prompt={modalActiveImage.userPrompt} />
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                        {props.viewerUserId && modalActiveImage.userId === props.viewerUserId ? (
                          <span className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted">
                            <HeartIcon className="h-4 w-4 shrink-0" />
                            <span>{modalActiveImage.likeCount}</span>
                          </span>
                        ) : modalLocked ? (
                          <span className="inline-flex cursor-default items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-muted">
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
                            disabled={!canLikeImage(modalActiveImage) || !!likingIds[modalActiveImage.id]}
                            className={`inline-flex items-center gap-2 rounded-md border bg-bg-surface px-3 py-2 text-sm font-medium transition hover:bg-bg-raised disabled:cursor-not-allowed ${
                              modalActiveImage.likedByViewer
                                ? "border-red-500/55 text-red-500"
                                : "border-border text-text-primary disabled:opacity-60"
                            }`}
                          >
                            <HeartIcon
                              filled={modalActiveImage.likedByViewer}
                              className={`h-4 w-4 shrink-0 ${modalActiveImage.likedByViewer ? "text-red-500" : ""}`}
                            />
                            <span>{modalActiveImage.likeCount}</span>
                          </button>
                        )}
                        {props.viewerUserId && modalActiveImage.userId === props.viewerUserId ? (
                          <button
                            type="button"
                            onClick={() =>
                              void setImagePublicState(modalActiveImage.id, !modalActiveImage.isPublic)
                            }
                            disabled={!!shareUpdatingIds[modalActiveImage.id]}
                            className={`inline-flex h-9 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-semibold transition disabled:opacity-60 ${
                              modalActiveImage.isPublic
                                ? "border-error/35 bg-error/10 text-error"
                                : "border-success/35 bg-success/10 text-success"
                            }`}
                          >
                            {shareUpdatingIds[modalActiveImage.id]
                              ? "Saving…"
                              : modalActiveImage.isPublic
                                ? "Make private"
                                : "Make public"}
                          </button>
                        ) : null}
                        <AdminFeaturedImageToggle
                          show={props.isAdmin}
                          imageId={modalActiveImage.id}
                          isFeatured={modalActiveImage.isFeatured}
                          onFeaturedChange={(next) => {
                            setImagesById((prev) => ({
                              ...prev,
                              [modalActiveImage.id]: { ...prev[modalActiveImage.id]!, isFeatured: next },
                            }));
                          }}
                        />
                        <Link
                          href={`/gallery/${modalActiveImage.bookId}?from=gallery`}
                          onClick={() => closeModal()}
                          className={modalViewGalleryButtonClass}
                        >
                          View Public Gallery
                        </Link>
                      </div>
                      <div className="shrink-0 text-sm text-text-muted">
                        <span>{modalActiveImage.userName?.trim() || "Anonymous reader"}</span>
                        <span className="mx-2 text-text-secondary/80" aria-hidden>
                          •
                        </span>
                        <span>{formatCardDate(modalActiveImage.createdAt)}</span>
                      </div>
                    </div>

                    {modalLocked ? (
                      <div className="space-y-3 rounded-lg border border-border/90 bg-bg-base/60 p-3">
                        {modalCtaError ? <p className="text-sm text-error">{modalCtaError}</p> : null}
                        {!props.isLoggedIn ? (
                          <p className="text-sm text-text-secondary">
                            Sign in to track reading progress and unlock gallery images tied to your library
                            books.
                          </p>
                        ) : !props.isAdmin && !bookInLibrary ? (
                          <>
                            <p className="text-sm text-text-secondary">
                              Add this book to your library to track your progress
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={addLibraryPending}
                                onClick={() => void addBookFromGalleryModal(modalActiveImage.bookId, "reader")}
                                className="inline-flex items-center rounded-md border border-accent/40 bg-accent-muted px-3 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
                              >
                                Add to Library &amp; Start Reading
                              </button>
                              <button
                                type="button"
                                disabled={addLibraryPending}
                                onClick={() => void addBookFromGalleryModal(modalActiveImage.bookId, "stay")}
                                className="text-sm font-medium text-accent-text underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                Add to Library only
                              </button>
                            </div>
                          </>
                        ) : !props.isAdmin && bookInLibrary ? (
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
                                className="inline-flex items-center rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-success disabled:opacity-50"
                              >
                                Unlock all {modalActiveImage.bookTitle} images
                              </button>
                              <Link
                                href={`/library?book=${modalActiveImage.bookId}`}
                                onClick={() => closeModal()}
                                className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
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
                    imageId={modalActiveImage.id}
                    sessionCommentsUnlocked={props.isAdmin || (props.isLoggedIn && gallerySessionRevealAll)}
                    isLoggedIn={props.isLoggedIn}
                    canInteract={!modalLocked}
                    viewerDisplayName={props.viewerDisplayName}
                    onPostedVisibleComment={() => {
                      const id = modalActiveImage.id;
                      setImagesById((prev) => ({
                        ...prev,
                        [id]: {
                          ...prev[id]!,
                          commentCount: (prev[id]?.commentCount ?? 0) + 1,
                        },
                      }));
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

function BadgeLegend({
  legendOpen,
  setLegendOpen,
}: {
  legendOpen: boolean;
  setLegendOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="group relative" onMouseLeave={() => setLegendOpen(false)}>
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
            <LockKeyholeOpen className="h-4 w-4" style={{ color: "#00BCD4" }} aria-hidden />
            <span>Aqua - Your image</span>
          </div>
          <div className="flex items-center gap-2">
            <LockKeyholeOpen className="h-4 w-4" style={{ color: "#22C55E" }} aria-hidden />
            <span>Green - Safe to view (within your reading progress)</span>
          </div>
          <div className="flex items-center gap-2">
            <LockKeyholeOpen className="h-4 w-4" style={{ color: "#EAB308" }} aria-hidden />
            <span>Yellow - Visible (spoiler protection is off)</span>
          </div>
          <div className="flex items-center gap-2">
            <LockKeyholeOpen className="h-4 w-4" style={{ color: "#EF4444" }} aria-hidden />
            <span>Red - Unlocked for this book (global protection is on)</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" style={{ color: "#F59E0B" }} fill="currentColor" aria-hidden />
            <span>Gold star - Featured image</span>
          </div>
        </div>
      </div>
    </div>
  );
}
