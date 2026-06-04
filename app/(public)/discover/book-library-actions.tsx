"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookId: string;
  initialInLibrary: boolean;
  isLoggedIn: boolean;
  /** Optional: discover concept CTA styling */
  variant?: "default" | "discoverGold";
};

const discoverCtaBtn =
  "rounded border px-6 py-2.5 text-xs font-bold uppercase tracking-[0.2em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:cursor-not-allowed disabled:opacity-60";

export function BookLibraryActions({
  bookId,
  initialInLibrary,
  isLoggedIn,
  variant = "default",
}: Props) {
  const router = useRouter();
  const [inLibrary, setInLibrary] = useState(initialInLibrary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div>
        <Link
          href="/sign-in"
          className="inline-flex rounded-md border border-accent/35 bg-accent-muted px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent/70 hover:bg-accent-muted sm:px-4 sm:text-sm"
        >
          Sign in to add to library
        </Link>
      </div>
    );
  }

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const method = inLibrary ? "DELETE" : "POST";
      const res = await fetch(`/api/library/${bookId}`, { method });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Something went wrong");
        return;
      }
      setInLibrary(!inLibrary);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          variant === "discoverGold"
            ? `${discoverCtaBtn} ${inLibrary ? "discover-cta-in-library" : "discover-cta-add-library"}`
            : "rounded-md border border-border bg-bg-raised px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent/60 hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
        }
      >
        {pending
          ? "…"
          : inLibrary
            ? variant === "discoverGold"
              ? "In library ✓"
              : "Remove from Library"
            : variant === "discoverGold"
              ? "Add to library →"
              : "Add to Library"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-error">{error}</p>
      ) : null}
    </div>
  );
}
