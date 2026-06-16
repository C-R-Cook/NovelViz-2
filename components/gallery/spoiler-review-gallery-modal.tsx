"use client";

import "@/app/(public)/gallery/gallery-redesign.css";
import { GalleryImageComments } from "@/components/gallery/gallery-image-comments";
import { AdminFeaturedImageToggle } from "@/components/gallery/admin-featured-image-toggle";
import { GalleryImagePromptDisclosure } from "@/components/gallery/gallery-image-prompt-disclosure";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import Link from "next/link";
import { useEffect } from "react";

type Props = {
  row: AdminSpoilerCommentRow;
  onClose: () => void;
  /** Comment id to scroll to in the sidebar; default is this row. Pass `null` to disable. */
  highlightCommentId?: string | null;
  /** Border style for the highlighted row. */
  highlightVariant?: "accent" | "flagged";
};

function resolveModalHighlightCommentId(rowId: string, explicit: string | null | undefined): string | null {
  if (explicit === undefined) return rowId;
  return explicit;
}

export function SpoilerReviewGalleryModal({
  row,
  onClose,
  highlightCommentId: highlightCommentIdProp,
  highlightVariant = "accent",
}: Props) {
  const highlightCommentId = resolveModalHighlightCommentId(row.id, highlightCommentIdProp);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const galleryHref = `/gallery/${row.bookId}?image=${encodeURIComponent(row.imageId)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Public gallery preview: ${row.bookTitle}`}
        className="relative flex h-[90dvh] max-h-[90dvh] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg-surface/80 text-text-primary transition hover:bg-bg-raised"
          onClick={onClose}
          aria-label="Close preview"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="flex min-h-0 w-full flex-1 flex-row overflow-hidden sm:pt-1">
          <div className="flex min-h-0 min-w-0 flex-[2] flex-col border-r border-border">
            <div className="relative flex min-h-[200px] flex-1 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">
              <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
                <ModalImageSwipeView
                  slide={{
                    id: row.imageId,
                    imageUrl: row.imageUrl,
                    userPrompt: row.userPrompt ?? "",
                    locked: false,
                  }}
                  direction={0}
                  onDirectionConsumed={() => {}}
                  sizes="(max-width: 1024px) 66vw, 640px"
                />
              </div>
            </div>

            <div className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="min-w-0 flex-1 text-lg font-semibold text-text-primary">{row.bookTitle}</h2>
                  <p className="shrink-0 text-sm text-text-muted">Chapter {row.chapterNumberAtTime}</p>
                </div>
                {row.userPrompt?.trim() ? <GalleryImagePromptDisclosure prompt={row.userPrompt} /> : null}
                <AdminFeaturedImageToggle
                  show
                  imageId={row.imageId}
                  isFeatured={row.imageIsFeatured}
                />
                <Link
                  href={galleryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm font-medium text-accent-text underline-offset-2 hover:underline"
                >
                  Open full gallery page ↗
                </Link>
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-surface/40">
            <GalleryImageComments
              layout="sidebar"
              className="h-full min-h-0"
              imageId={row.imageId}
              isLoggedIn
              canInteract
              viewerDisplayName={null}
              highlightCommentId={highlightCommentId ?? undefined}
              highlightCommentStyle={highlightVariant}
              composerDisabled
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
