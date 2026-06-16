"use client";

import { AdminFeaturedImageToggle } from "@/components/gallery/admin-featured-image-toggle";
import { ModalImageNavArrows } from "@/components/gallery/modal-image-nav-arrows";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import { GeneratedPromptFaqLink } from "@/components/generated-prompt-faq-link";
import { ImageThumbnailBottomBar } from "@/components/image-thumbnail-bottom-bar";
import { PromptDetailsDisclosure } from "@/components/prompt-details-disclosure";
import type { DashboardReaderData } from "@/lib/dashboard-data";
import type { DashboardUserRole } from "@/lib/dashboard-tab";
import { isTextEntryFocused } from "@/lib/is-text-entry-focused";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type DashboardReaderImageRow = DashboardReaderData["recentImages"][number];

type Props = {
  images: DashboardReaderImageRow[];
  reducedMotion: boolean;
  viewerRole: DashboardUserRole;
};

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <div className="dashboard-slabel-row">
      <span className="dashboard-slabel">{label}</span>
      <span className="dashboard-slabel-line" aria-hidden />
      {right ? <span className="dashboard-slabel-right">{right}</span> : null}
    </div>
  );
}

export function DashboardReaderImages({ images: initialImages, reducedMotion, viewerRole }: Props) {
  const [images, setImages] = useState(initialImages);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [shareUpdatingIds, setShareUpdatingIds] = useState<Record<string, boolean>>({});
  const [swipeDir, setSwipeDir] = useState<0 | 1 | -1>(0);
  const [swipeBusy, setSwipeBusy] = useState(false);

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  const selectedImage = useMemo(
    () => (selectedImageId ? images.find((img) => img.id === selectedImageId) ?? null : null),
    [images, selectedImageId],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return images.findIndex((img) => img.id === selectedImage.id);
  }, [images, selectedImage]);

  const dismissModal = useCallback(() => {
    setSelectedImageId(null);
    setSwipeDir(0);
  }, []);

  const bumpModalIndex = useCallback(
    (delta: number) => {
      if (!selectedImage || swipeBusy || images.length <= 1) return;
      const i = images.findIndex((img) => img.id === selectedImage.id);
      if (i < 0) return;
      const next = images[i + delta];
      if (!next) return;
      setSwipeDir(delta > 0 ? 1 : -1);
      setSelectedImageId(next.id);
    },
    [images, selectedImage, swipeBusy],
  );

  useEffect(() => {
    if (!selectedImage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissModal();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTextEntryFocused()) return;
      e.preventDefault();
      if (swipeBusy) return;
      bumpModalIndex(e.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedImage, swipeBusy, dismissModal, bumpModalIndex]);

  useEffect(() => {
    setSwipeDir(0);
  }, [selectedImageId]);

  const setImagePublicState = useCallback(
    async (imageId: string, isPublic: boolean) => {
      if (!imageId || shareUpdatingIds[imageId]) return;

      const previous = images.find((item) => item.id === imageId)?.isPublic;

      setShareUpdatingIds((prev) => ({ ...prev, [imageId]: true }));
      setImages((prev) => prev.map((item) => (item.id === imageId ? { ...item, isPublic } : item)));

      try {
        const res = await fetch(`/api/gallery/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          image?: { isPublic?: boolean };
          error?: string;
        };
        if (!res.ok || typeof data.image?.isPublic !== "boolean") {
          throw new Error(data.error || "Failed to update sharing");
        }

        const resolved = data.image.isPublic;
        setImages((prev) =>
          prev.map((item) => (item.id === imageId ? { ...item, isPublic: resolved } : item)),
        );
      } catch {
        if (typeof previous === "boolean") {
          setImages((prev) =>
            prev.map((item) => (item.id === imageId ? { ...item, isPublic: previous } : item)),
          );
        }
      } finally {
        setShareUpdatingIds((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [images, shareUpdatingIds],
  );

  return (
    <>
      <div>
        <SectionLabel label="Recent images" right={`${images.length} shown`} />
        {images.length === 0 ? (
          <p className="text-sm text-text-secondary">No images yet.</p>
        ) : (
          <div className="dashboard-image-strip">
            {images.map((img, i) => {
              const delay = reducedMotion ? 0 : i * 65;
              const shareUpdating = !!shareUpdatingIds[img.id];
              return (
                <article
                  key={img.id}
                  className="dashboard-image-card dashboard-stagger-item"
                  style={delay ? { animationDelay: `${delay}ms` } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedImageId(img.id)}
                    className="dashboard-image-thumb block w-full cursor-pointer overflow-hidden text-left"
                    aria-label={`Open image from ${img.bookTitle}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs */}
                    <img src={img.imageUrl} alt="" className="dashboard-image-thumb-img" />
                    <ImageThumbnailBottomBar />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2">
                      <p className="line-clamp-2 text-[9px] font-medium leading-snug text-text-primary/95">
                        {img.bookTitle}
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                          <span
                            className="inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-bg-surface/70 px-1.5 py-0.5 text-[9px] font-medium text-text-primary"
                            title={`${img.commentCount} comment${img.commentCount === 1 ? "" : "s"}`}
                          >
                            <MessageCircle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                            <span>{img.commentCount}</span>
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-bg-surface/70 px-1.5 py-0.5 text-[9px] font-medium text-text-muted"
                            title={`${img.likeCount} like${img.likeCount === 1 ? "" : "s"}`}
                          >
                            <HeartIcon className="h-3 w-3 shrink-0" />
                          <span>{img.likeCount}</span>
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={shareUpdating}
                    onClick={() => void setImagePublicState(img.id, !img.isPublic)}
                    className={`dashboard-image-share-btn ${
                      img.isPublic
                        ? "dashboard-image-share-btn--public"
                        : "dashboard-image-share-btn--private"
                    }`}
                    aria-label={
                      shareUpdating
                        ? "Saving visibility"
                        : img.isPublic
                          ? "Remove from public gallery"
                          : "Share in public gallery"
                    }
                    title={
                      shareUpdating
                        ? "Saving…"
                        : img.isPublic
                          ? "Remove from public gallery"
                          : "Share in public gallery"
                    }
                  >
                    {shareUpdating ? "Saving…" : img.isPublic ? "Public" : "Private"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generated image details"
          onClick={() => dismissModal()}
        >
          <div
            className="flex h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface p-3 shadow-2xl sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{selectedImage.bookTitle}</p>
                <p className="text-[11px] text-text-muted sm:text-xs">
                  Chapter {selectedImage.chapterNumberAtTime} ·{" "}
                  {new Date(selectedImage.createdAtMs).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissModal()}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-raised sm:text-xs"
              >
                Close
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ModalImageSwipeView
                slide={{
                  id: selectedImage.id,
                  imageUrl: selectedImage.imageUrl,
                  userPrompt: selectedImage.userPrompt,
                  locked: false,
                }}
                direction={swipeDir}
                onDirectionConsumed={() => setSwipeDir(0)}
                onAnimatingChange={setSwipeBusy}
                sizes="(max-width: 768px) 100vw, min(896px, 100vw)"
              />
              <ModalImageNavArrows
                show={images.length > 1}
                canPrev={selectedIndex > 0 && !swipeBusy}
                canNext={selectedIndex >= 0 && selectedIndex < images.length - 1 && !swipeBusy}
                onPrev={() => bumpModalIndex(-1)}
                onNext={() => bumpModalIndex(1)}
              />
            </div>

            <div className="mt-3 shrink-0 space-y-4">
              <div className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => void setImagePublicState(selectedImage.id, !selectedImage.isPublic)}
                  disabled={!!shareUpdatingIds[selectedImage.id]}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedImage.isPublic
                      ? "border-error/35 bg-error/10 text-error"
                      : "border-success/35 bg-success/10 text-success"
                  }`}
                >
                  {shareUpdatingIds[selectedImage.id]
                    ? "Saving…"
                    : selectedImage.isPublic
                      ? "Make private"
                      : "Make public"}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
                <p className="mt-1 text-xs text-text-secondary">
                  {selectedImage.isPublic
                    ? "This image is currently visible in the public gallery."
                    : "Share this image with the NovelViz community."}
                </p>
                <AdminFeaturedImageToggle
                  show={viewerRole === "admin"}
                  imageId={selectedImage.id}
                  isFeatured={selectedImage.isFeatured}
                  className="mt-2"
                  onFeaturedChange={(next) => {
                    setImages((rows) =>
                      rows.map((row) => (row.id === selectedImage.id ? { ...row, isFeatured: next } : row)),
                    );
                  }}
                />
              </div>

              <PromptDetailsDisclosure label="Original prompt">
                <p className="mt-2 text-xs text-text-primary sm:text-sm">{selectedImage.userPrompt}</p>
              </PromptDetailsDisclosure>
              <PromptDetailsDisclosure label="Generated prompt" actions={<GeneratedPromptFaqLink />}>
                <p className="mt-2 text-xs text-text-primary sm:text-sm">{selectedImage.fullPrompt}</p>
              </PromptDetailsDisclosure>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
