"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
};

export function CoverImagePreviewModal({ open, imageUrl, title, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cover preview: ${title}`}
        className="relative max-h-[min(90vh,36rem)] max-w-[min(90vw,18rem)] rounded-xl border border-border bg-bg-surface p-3 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-surface/90 text-text-primary transition hover:bg-bg-raised"
          onClick={onClose}
          aria-label="Close cover preview"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- external cover URL preview */}
        <img
          src={imageUrl}
          alt={`Cover for ${title}`}
          className="max-h-[min(75vh,32rem)] w-auto max-w-[min(90vw,16rem)] object-contain"
        />
      </div>
    </div>
  );
}
