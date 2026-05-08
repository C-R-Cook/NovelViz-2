"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type ModalImageNavArrowsProps = {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** When false, nothing is rendered (e.g. only one slide). */
  show: boolean;
};

const navBtn =
  "absolute top-1/2 z-[25] inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/45 bg-bg-surface/50 text-text-muted shadow-sm backdrop-blur-[2px] transition hover:border-border/75 hover:bg-bg-surface/80 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:pointer-events-none disabled:opacity-[0.2] [&_svg]:opacity-[0.85]";

/** Subtle overlays on image modals — use with arrows / keyboard carousel. */
export function ModalImageNavArrows({ show, canPrev, canNext, onPrev, onNext }: ModalImageNavArrowsProps) {
  if (!show) return null;
  return (
    <>
      <button
        type="button"
        className={`${navBtn} left-2 sm:left-3`}
        aria-label="Previous image"
        disabled={!canPrev}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`${navBtn} right-2 sm:right-3`}
        aria-label="Next image"
        disabled={!canNext}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <ChevronRight className="h-5 w-5" aria-hidden strokeWidth={2} />
      </button>
    </>
  );
}
