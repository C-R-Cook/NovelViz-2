"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookId: string;
  initialInLibrary: boolean;
  isLoggedIn: boolean;
};

export function BookLibraryActions({
  bookId,
  initialInLibrary,
  isLoggedIn,
}: Props) {
  const router = useRouter();
  const [inLibrary, setInLibrary] = useState(initialInLibrary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="pt-2">
        <Link
          href="/sign-in"
          className="inline-flex rounded-lg border border-amber-800/50 bg-amber-950/30 px-5 py-2.5 text-sm font-medium text-amber-100/95 transition hover:border-amber-600/60 hover:bg-amber-950/50"
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
    <div className="pt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-amber-800/50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "…"
          : inLibrary
            ? "Remove from Library"
            : "Add to Library"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-400/90">{error}</p>
      ) : null}
    </div>
  );
}
