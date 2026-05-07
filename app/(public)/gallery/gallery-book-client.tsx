"use client";

import { SpoilerToggle } from "@/components/gallery/spoiler-toggle";
import { effectiveChapterGateMode } from "@/lib/gallery-spoiler";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpoilerProtection } from "@db";

const SESSION_UNLOCK_KEY = "novelviz_session_unlocks";

type ApiImage = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  userId: string;
  username: string;
  likeCount: number;
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

function readSessionUnlockMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_UNLOCK_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeSessionUnlockBook(bookId: string, on: boolean) {
  const map = readSessionUnlockMap();
  if (on) map[bookId] = true;
  else delete map[bookId];
  sessionStorage.setItem(SESSION_UNLOCK_KEY, JSON.stringify(map));
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
}: Props) {
  const router = useRouter();
  const [images, setImages] = useState<ApiImage[]>([]);
  const [currentChapterNumber, setCurrentChapterNumber] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spoilerSetting, setSpoilerSetting] = useState<SpoilerProtection>(userBookSpoiler ?? "INHERIT");
  const [sessionUnlock, setSessionUnlock] = useState(false);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const gateModeForSession = useMemo(
    () => effectiveChapterGateMode(userBookSpoiler !== null ? spoilerSetting : undefined, globalSpoilerProtection),
    [userBookSpoiler, spoilerSetting, globalSpoilerProtection],
  );

  const showSessionButton = isLoggedIn && !isAdmin && gateModeForSession === "gate_chapters";

  useEffect(() => {
    if (userBookSpoiler) setSpoilerSetting(userBookSpoiler);
  }, [userBookSpoiler]);

  useEffect(() => {
    setSessionUnlock(!!readSessionUnlockMap()[bookId]);
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
        setImages(data.images ?? []);
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
    void fetchImages(sessionUnlock);
  }, [fetchImages, sessionUnlock]);

  function toggleSessionUnlock() {
    const next = !sessionUnlock;
    writeSessionUnlockBook(bookId, next);
    setSessionUnlock(next);
  }

  function displayLocked(apiLocked: boolean): boolean {
    if (isAdmin) return false;
    if (sessionUnlock) return false;
    return apiLocked;
  }

  const canLike = isLoggedIn || isAdmin;

  async function likeImage(imageId: string) {
    if (!canLike || likingIds[imageId]) return;
    setLikingIds((prev) => ({ ...prev, [imageId]: true }));
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, likeCount: img.likeCount + 1 } : img)),
    );
    try {
      const res = await fetch(`/api/gallery/${imageId}/like`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { likeCount?: number };
      if (!res.ok || typeof data.likeCount !== "number") {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId ? { ...img, likeCount: Math.max(0, img.likeCount - 1) } : img,
          ),
        );
        return;
      }
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, likeCount: data.likeCount! } : img)));
    } catch {
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, likeCount: Math.max(0, img.likeCount - 1) } : img,
        ),
      );
    } finally {
      setLikingIds((prev) => ({ ...prev, [imageId]: false }));
    }
  }

  const modalImage = modalIndex !== null ? images[modalIndex] : null;
  const modalLocked = modalImage ? displayLocked(modalImage.isLocked) : false;
  const chapterGap =
    modalLocked && modalImage
      ? Math.max(1, modalImage.chapterNumberAtTime - (currentChapterNumber ?? 0))
      : null;

  async function unlockBookSpoilers() {
    const res = await fetch(`/api/user-books/${bookId}/spoiler-protection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setting: "UNLOCKED" }),
    });
    if (!res.ok) return;
    setModalIndex(null);
    router.refresh();
  }

  useEffect(() => {
    if (modalIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalIndex(null);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setModalIndex((i) => {
        if (i === null) return i;
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const next = i + delta;
        if (next < 0 || next >= images.length) return i;
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalIndex, images.length]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <nav className="mb-6 text-sm text-text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/gallery" className="font-medium text-accent-text underline-offset-2 hover:underline">
              Gallery
            </Link>
          </li>
          <li aria-hidden className="text-text-secondary/80">
            /
          </li>
          <li className="text-text-primary">{bookTitle}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-6 border-b border-border/80 pb-8 sm:flex-row sm:items-start">
        <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-base shadow-sm sm:h-40 sm:w-32">
          {coverImageUrl ? (
            <Image src={coverImageUrl} alt="" fill className="object-cover" sizes="128px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-text-muted">No cover</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{bookTitle}</h1>
            <p className="mt-1 text-sm text-text-secondary">{bookAuthor}</p>
            <p className="mt-2 text-sm text-text-muted">
              {imageCount} public {imageCount === 1 ? "image" : "images"}
              {loading ? " · Loading…" : null}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {isLoggedIn && userBookSpoiler !== null ? (
              <SpoilerToggle
                bookId={bookId}
                currentSetting={spoilerSetting}
                globalSetting={globalSpoilerProtection}
                onUpdate={(next) => {
                  setSpoilerSetting(next);
                  router.refresh();
                }}
              />
            ) : isLoggedIn ? (
              <p className="max-w-xl text-sm text-text-secondary">
                Add this book to your library to adjust spoiler settings for this gallery.{" "}
                <Link href="/discover" className="font-medium text-accent-text underline-offset-2 hover:underline">
                  Discover books
                </Link>
              </p>
            ) : null}

            {showSessionButton ? (
              <button
                type="button"
                onClick={() => toggleSessionUnlock()}
                className="inline-flex items-center rounded-md border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-raised"
              >
                {sessionUnlock ? "Restore spoiler protection" : "Show everything this session"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {sessionUnlock && showSessionButton ? (
        <div
          className="mt-6 rounded-lg border border-warning/45 bg-warning/10 px-4 py-3 text-sm text-text-primary"
          role="status"
        >
          Showing all images this session only — your spoiler protection is unchanged.
        </div>
      ) : null}

      {loadError ? <p className="mt-6 text-sm text-error">{loadError}</p> : null}

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => {
          const locked = displayLocked(image.isLocked);
          const username = image.username?.trim() || "Anonymous reader";
          const likeDisabled = !canLike || !!likingIds[image.id];

          return (
            <article key={image.id} className="group">
              <div className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-bg-base text-left shadow-sm outline-none transition hover:border-border-subtle focus-visible:ring-2 focus-visible:ring-accent/40"
                  onClick={() => setModalIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setModalIndex(index);
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-bg-overlay/90 to-transparent p-3 pt-8 pr-16">
                    <p className="text-xs font-medium text-text-muted">Chapter {image.chapterNumberAtTime}</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary line-clamp-1">{username}</p>
                  </div>
                  {locked ? (
                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg-overlay/45 px-2 text-center">
                      <LockIcon className="h-8 w-8 text-accent-text/95" />
                      <p className="text-xs font-medium text-text-primary">Chapter {image.chapterNumberAtTime}</p>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={likeDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void likeImage(image.id);
                  }}
                  className="absolute bottom-2 right-2 z-30 inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg-surface/90 px-2 py-1 text-xs font-medium text-text-primary shadow-sm transition hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Like ${image.likeCount} times`}
                >
                  <HeartIcon className="h-3.5 w-3.5" />
                  <span>{image.likeCount}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {modalImage ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalIndex(null);
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
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary transition hover:bg-bg-raised"
              onClick={() => setModalIndex(null)}
              aria-label="Close modal"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-col overflow-hidden sm:pt-1">
              <div className="relative flex h-[min(55vh,calc(90vh-12rem))] max-h-[55vh] w-full flex-shrink-0 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">
                <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border bg-bg-base">
                  <Image
                    src={modalImage.imageUrl}
                    alt={modalImage.userPrompt}
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
                    <h2 className="text-lg font-semibold text-text-primary">{modalImage.bookTitle}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{modalImage.author}</p>
                  </div>
                  <p className="text-sm text-text-muted">Generated at Chapter {modalImage.chapterNumberAtTime}</p>
                  {!modalLocked ? (
                    <div className="rounded-lg border border-border/90 bg-bg-base/60 p-3">
                      <p className="text-sm font-medium text-text-muted">Your prompt</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{modalImage.userPrompt}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => void likeImage(modalImage.id)}
                      disabled={!canLike || !!likingIds[modalImage.id]}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-medium transition hover:bg-bg-raised disabled:opacity-60"
                    >
                      <HeartIcon className="h-4 w-4" />
                      <span>{modalImage.likeCount}</span>
                    </button>
                    <div className="text-sm text-text-muted">
                      <span>{modalImage.username?.trim() || "Anonymous reader"}</span>
                      <span className="mx-2 text-text-secondary/80" aria-hidden>
                        •
                      </span>
                      <span>{formatCardDate(modalImage.createdAt)}</span>
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
                          onClick={() => void unlockBookSpoilers()}
                          className="inline-flex items-center rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-success transition hover:brightness-110 active:scale-95"
                        >
                          Unlock all {modalImage.bookTitle} images
                        </button>
                        <Link
                          href={`/reader/${modalImage.bookId}`}
                          onClick={() => setModalIndex(null)}
                          className="text-sm font-medium text-accent-text underline-offset-2 transition hover:underline"
                        >
                          Continue reading →
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  <div className="border-t border-border/80 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-text-muted">
                        You&apos;re viewing this book&apos;s gallery — scroll up to browse all images.
                      </span>
                      {isLoggedIn && userBookSpoiler !== null ? (
                        <SpoilerToggle
                          bookId={bookId}
                          currentSetting={spoilerSetting}
                          globalSetting={globalSpoilerProtection}
                          onUpdate={(next) => {
                            setSpoilerSetting(next);
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
