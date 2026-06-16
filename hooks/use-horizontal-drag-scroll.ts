"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

type DragState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  scrollLeft0: number;
  moved: boolean;
};

type Options = {
  enabled?: boolean;
  onDragMoved?: () => void;
};

const DRAG_THRESHOLD_PX = 8;

export function useHorizontalDragScroll({ enabled = true, onDragMoved }: Options = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    pointerId: null,
    startX: 0,
    startY: 0,
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
        startY: e.clientY,
        scrollLeft0: el.scrollLeft,
        moved: false,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!enabled || d.pointerId !== e.pointerId) return;
      const el = scrollRef.current;
      if (!el) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (!d.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        d.moved = true;
        setDragging(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      el.scrollLeft = d.scrollLeft0 - dx * 1.35;
    },
    [enabled],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!enabled) return;
      if (d.pointerId === null || d.pointerId !== e.pointerId) return;
      const el = scrollRef.current;
      if (el && d.moved) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (d.moved) onDragMoved?.();
      dragRef.current = {
        pointerId: null,
        startX: 0,
        startY: 0,
        scrollLeft0: 0,
        moved: false,
      };
      setDragging(false);
    },
    [enabled, onDragMoved],
  );

  return {
    scrollRef,
    dragging,
    stripClassName: dragging ? "book-row-strip--dragging" : "",
    pointerHandlers: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
        }
      : {},
  };
}
