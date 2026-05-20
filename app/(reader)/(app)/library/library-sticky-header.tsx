"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefCallback } from "react";
import { LibrarySectionHead } from "./library-section-head";

type Variant = "reading" | "shelf" | "shelf-solo" | "images";

type Props = {
  title: string;
  variant: Variant;
  stickyTop: number;
  anchorRef?: RefCallback<HTMLDivElement>;
  scrollAnchorClassName?: string;
  headChildren?: ReactNode;
  onTitleClick?: () => void;
};

export function LibraryStickyHeader({
  title,
  variant,
  stickyTop,
  anchorRef,
  scrollAnchorClassName = "",
  headChildren,
  onTitleClick,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting),
      { rootMargin: `-${stickyTop}px 0px 0px 0px`, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stickyTop]);

  const setAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      sentinelRef.current = node;
      anchorRef?.(node);
    },
    [anchorRef],
  );

  return (
    <>
      <div
        ref={setAnchorRef}
        className={`library-scroll-anchor library-sticky-sentinel ${scrollAnchorClassName}`.trim()}
        aria-hidden
      />
      <div
        className={`library-section-head-sticky library-section-head-sticky--${variant}${
          pinned ? " library-section-head-sticky--pinned" : ""
        }`}
      >
        <LibrarySectionHead title={title} onTitleClick={onTitleClick}>
          {headChildren}
        </LibrarySectionHead>
      </div>
    </>
  );
}
