"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ModalSwipeSlide = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  locked: boolean;
};

type ModalImageSwipeViewProps = {
  slide: ModalSwipeSlide;
  direction: -1 | 0 | 1;
  onDirectionConsumed: () => void;
  onAnimatingChange?: (animating: boolean) => void;
  sizes: string;
};

const DURATION_MS = 320;
/** Extra buffer so we always clear after the CSS transition even if `transitionend` never fires (e.g. bubbled from descendants). */
const DURATION_BUFFER_MS = 48;

function LockShade() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg-overlay/45 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 text-accent-text/95"
        aria-hidden
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="text-sm font-medium text-text-primary">Locked until you unlock this book</p>
    </div>
  );
}

function SlidePane({ slide, sizes }: { slide: ModalSwipeSlide; sizes: string }) {
  return (
    <div className="relative h-full w-full">
      <Image
        src={slide.imageUrl}
        alt={slide.userPrompt}
        fill
        unoptimized
        className={`object-contain object-center ${slide.locked ? "blur-[24px]" : ""}`}
        sizes={sizes}
        priority
      />
      {slide.locked ? <LockShade /> : null}
    </div>
  );
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Horizontally swaps the modal image: next (direction 1) slides in from the right; previous (-1) from the left.
 */
export function ModalImageSwipeView({
  slide,
  direction,
  onDirectionConsumed,
  onAnimatingChange,
  sizes,
}: ModalImageSwipeViewProps) {
  const consumeRef = useRef(onDirectionConsumed);
  const animNotifyRef = useRef(onAnimatingChange);
  consumeRef.current = onDirectionConsumed;
  animNotifyRef.current = onAnimatingChange;

  const committedRef = useRef(slide);
  const animCycleRef = useRef(0);
  const [outgoing, setOutgoing] = useState<ModalSwipeSlide | null>(null);
  const [motionSign, setMotionSign] = useState<1 | -1>(1);
  const [entered, setEntered] = useState(false);

  const finishAnimation = useRef(() => {});
  finishAnimation.current = () => {
    setOutgoing(null);
    setEntered(false);
    animNotifyRef.current?.(false);
    consumeRef.current();
  };

  useLayoutEffect(() => {
    const prev = committedRef.current;

    if (slide.id === prev.id) {
      committedRef.current = slide;
      return;
    }

    const reduceMotion = readPrefersReducedMotion();
    const effectiveMotion: -1 | 0 | 1 =
      reduceMotion || direction === 0 ? 0 : direction === -1 ? -1 : 1;

    if (effectiveMotion === 0) {
      committedRef.current = slide;
      setOutgoing(null);
      setEntered(false);
      animNotifyRef.current?.(false);
      consumeRef.current();
      return;
    }

    animCycleRef.current += 1;

    setMotionSign(effectiveMotion === 1 ? 1 : -1);
    setOutgoing(prev);
    committedRef.current = slide;
    setEntered(false);
    animNotifyRef.current?.(true);

    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by slide.id; outgoing excluded to avoid loops
  }, [slide.id, slide.imageUrl, slide.userPrompt, slide.locked, direction]);

  useEffect(() => {
    if (!outgoing || !entered) return;

    const reduceMotion = readPrefersReducedMotion();
    const ms = reduceMotion ? 0 : DURATION_MS + DURATION_BUFFER_MS;

    const cycleAtStart = animCycleRef.current;
    const id = window.setTimeout(() => {
      if (cycleAtStart !== animCycleRef.current) return;
      finishAnimation.current();
    }, ms);

    return () => window.clearTimeout(id);
  }, [outgoing, entered]);

  function handleIncomingTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    finishAnimation.current();
  }

  const reduceMs = readPrefersReducedMotion() ? 0 : DURATION_MS;

  const incomingTranslateStart = motionSign === 1 ? "translate-x-full" : "-translate-x-full";
  const outgoingTranslateEnd = motionSign === 1 ? "-translate-x-full" : "translate-x-full";

  if (!outgoing) {
    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-border bg-bg-base">
        <SlidePane slide={slide} sizes={sizes} />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-border bg-bg-base">
      <div
        className={`absolute inset-0 z-[1] transition-transform ease-out ${entered ? outgoingTranslateEnd : "translate-x-0"}`}
        style={{ transitionDuration: `${reduceMs}ms` }}
      >
        <SlidePane slide={outgoing} sizes={sizes} />
      </div>
      <div
        className={`absolute inset-0 z-[2] transition-transform ease-out ${entered ? "translate-x-0" : incomingTranslateStart}`}
        style={{ transitionDuration: `${reduceMs}ms` }}
        onTransitionEnd={handleIncomingTransitionEnd}
      >
        <SlidePane slide={slide} sizes={sizes} />
      </div>
    </div>
  );
}
