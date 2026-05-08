"use client";

import type { GalleryCardBadgeVariant } from "@/lib/gallery-card-spoiler-badge";
import { LockKeyholeOpen, Star } from "lucide-react";

type Props =
  | { kind: "featured-star" }
  | { kind: "library-padlock"; variant: GalleryCardBadgeVariant };

const PADLOCK_COLORS: Record<GalleryCardBadgeVariant, string> = {
  aqua: "#00BCD4",
  red: "#EF4444",
  green: "#22C55E",
  yellow: "#EAB308",
};

const PADLOCK_FOLD_BACKGROUNDS: Record<GalleryCardBadgeVariant, string> = {
  aqua: "rgba(0, 188, 212, 0.25)",
  red: "rgba(239, 68, 68, 0.25)",
  green: "rgba(34, 197, 94, 0.25)",
  yellow: "rgba(234, 179, 8, 0.25)",
};

const PADLOCK_GLOWS: Record<GalleryCardBadgeVariant, string> = {
  aqua: "drop-shadow(0 0 4px rgba(0, 188, 212, 0.8))",
  red: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))",
  green: "drop-shadow(0 0 4px rgba(34, 197, 94, 0.8))",
  yellow: "drop-shadow(0 0 4px rgba(234, 179, 8, 0.8))",
};

export function GalleryCardCornerBadge(props: Props) {
  const curlSizePx = 44;
  const iconDockSizePx = 28;
  const containerClass = "pointer-events-none absolute left-0 top-0 z-[15]";

  if (props.kind === "featured-star") {
    return (
      <div
        className={containerClass}
        style={{ width: `${curlSizePx}px`, height: `${curlSizePx}px` }}
        aria-hidden
      >
        <div
          className="absolute left-0 top-0 flex items-center justify-center"
          style={{
            width: `${iconDockSizePx}px`,
            height: `${iconDockSizePx}px`,
            backgroundColor: "rgba(245, 158, 11, 0.2)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
          }}
        />
        <div
          className="absolute left-0 top-0"
          style={{
            width: `${curlSizePx}px`,
            height: `${curlSizePx}px`,
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            background:
              "linear-gradient(225deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
            filter: "drop-shadow(1px 1px 3px rgba(0,0,0,0.28))",
          }}
        />
        <div
          className="absolute left-0 top-0"
          style={{
            width: `${curlSizePx}px`,
            height: `${curlSizePx}px`,
            clipPath: "polygon(0 0, 76% 0, 0 76%)",
            boxShadow: "inset -2px -2px 4px rgba(255,255,255,0.18)",
          }}
        />
        <Star
          className="absolute left-1.5 top-1.5 h-4 w-4"
          style={{ color: "#F59E0B", filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.8))" }}
          fill="currentColor"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={containerClass}
      style={{ width: `${curlSizePx}px`, height: `${curlSizePx}px` }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${iconDockSizePx}px`,
          height: `${iconDockSizePx}px`,
          backgroundColor: PADLOCK_FOLD_BACKGROUNDS[props.variant],
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${curlSizePx}px`,
          height: `${curlSizePx}px`,
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          background:
            "linear-gradient(225deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
          filter: "drop-shadow(1px 1px 3px rgba(0,0,0,0.28))",
        }}
      />
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${curlSizePx}px`,
          height: `${curlSizePx}px`,
          clipPath: "polygon(0 0, 76% 0, 0 76%)",
          boxShadow: "inset -2px -2px 4px rgba(255,255,255,0.18)",
        }}
      />
      <LockKeyholeOpen
        className="absolute left-1.5 top-1.5 h-4 w-4"
        style={{ color: PADLOCK_COLORS[props.variant], filter: PADLOCK_GLOWS[props.variant] }}
        aria-hidden
      />
    </div>
  );
}
