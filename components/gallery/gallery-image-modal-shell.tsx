"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Shared dialog sizing — fits below site header with shell padding. */
export const galleryImageModalDialogClassName =
  "relative flex min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface shadow-2xl";

export const galleryImageModalDialogHeightClassName =
  "h-[min(90dvh,calc(100dvh-3.5rem-2rem))] max-h-[min(90dvh,calc(100dvh-3.5rem-2rem))]";

type Props = {
  onClose: () => void;
  children: ReactNode;
};

export function GalleryImageModalShell({ onClose, children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250]">
      <div
        className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
        aria-hidden
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 top-14 flex items-center justify-center overflow-y-auto overscroll-contain p-4 pb-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
