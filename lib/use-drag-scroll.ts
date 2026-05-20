"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type DragState = {
  pointerId: number | null;
  startX: number;
  scrollLeft0: number;
  moved: boolean;
};

const initialDrag: DragState = {
  pointerId: null,
  startX: 0,
  scrollLeft0: 0,
  moved: false,
};

/**
 * Horizontal drag-to-scroll for pointer devices (Discover carousel pattern).
 */
export function useDragScroll(options?: {
  enabled?: boolean;
  /** Ignore drag when pointer down starts on matching selector (e.g. shelf cards). */
  ignoreSelector?: string;
}) {
  const enabled = options?.enabled ?? true;
  const ignoreSelector = options?.ignoreSelector;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(initialDrag);
  const blockClickUntilRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (ignoreSelector && target?.closest(ignoreSelector)) return;
      const el = scrollerRef.current;
      if (!el) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        scrollLeft0: el.scrollLeft,
        moved: false,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [enabled, ignoreSelector],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      el.scrollLeft = d.scrollLeft0 - dx * 1.35;
    }
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const el = scrollerRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (d.moved) {
      blockClickUntilRef.current = Date.now() + 450;
    }
    dragRef.current = initialDrag;
    setDragging(false);
  }, []);

  const shouldIgnoreClick = useCallback(() => Date.now() < blockClickUntilRef.current, []);

  const onPointerLeave = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current.pointerId === e.pointerId) endDrag(e);
    },
    [endDrag],
  );

  const setScrollerRef = useCallback((node: HTMLDivElement | null) => {
    scrollerRef.current = node;
  }, []);

  return {
    setScrollerRef,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave,
    shouldIgnoreClick,
  };
}
