"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  imageId: string;
  isFeatured: boolean;
  /** When false, renders nothing (caller passes isAdmin). */
  show: boolean;
  disabled?: boolean;
  className?: string;
  onFeaturedChange?: (isFeatured: boolean) => void;
};

const baseClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

export function AdminFeaturedImageToggle({
  imageId,
  isFeatured,
  show,
  disabled,
  className,
  onFeaturedChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [featured, setFeatured] = useState(isFeatured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFeatured(isFeatured);
    setError(null);
  }, [imageId, isFeatured]);

  if (!show) return null;

  async function toggle() {
    if (busy || disabled) return;
    const next = !featured;
    setBusy(true);
    setError(null);
    setFeatured(next);
    try {
      const res = await fetch(`/api/admin/images/${imageId}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        isFeatured?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      const confirmed = typeof data.isFeatured === "boolean" ? data.isFeatured : next;
      setFeatured(confirmed);
      onFeaturedChange?.(confirmed);
    } catch (e) {
      setFeatured(featured);
      setError(e instanceof Error ? e.message : "Could not update featured status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || disabled}
        title={
          featured
            ? "Remove from Discover community visions"
            : "Feature on Discover (image must be public to appear)"
        }
        className={`${baseClass} ${
          featured
            ? "border-[#C49A3C]/45 bg-[#C49A3C]/15 text-[#C49A3C]"
            : "border-border bg-bg-surface text-text-primary"
        } ${className ?? ""}`}
      >
        <Star className={`h-4 w-4 shrink-0 ${featured ? "fill-current" : ""}`} aria-hidden />
        {busy ? "Saving…" : featured ? "Featured" : "Set featured"}
      </button>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </span>
  );
}
