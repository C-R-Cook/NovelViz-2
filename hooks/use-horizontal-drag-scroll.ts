"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

type DragState = {
  pointerId: number | null;
  startX: number;
  scrollLeft0: number;
  moved: boolean;
};

type Options = {
  enabled?: boolean;
  onDragMoved?: () => void;
};

export function useHorizontalDragScroll({ enabled = true, onDragMoved }: Options = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    pointerId: null,
    startX: 0,
    scrollLeft0: 0,
    moved: false,
  });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || e.button !== 0) return;
      const el = scrollRef.current;
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
    [enabled],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const el = scrollRef.current;
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

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (d.pointerId !== e.pointerId) return;
      const el = scrollRef.current;
      if (el) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (d.moved) onDragMoved?.();
      dragRef.current = { pointerId: null, startX: 0, scrollLeft0: 0, moved: false };
      setDragging(false);
    },
    [onDragMoved],
  );

  return {
    scrollRef,
    dragging,
    stripClassName: dragging ? "gallery-book-row-strip--dragging" : "",
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
