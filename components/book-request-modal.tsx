"use client";

import { useCallback, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/20 transition placeholder:text-zinc-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/25";
const labelClass = "block text-sm font-medium text-zinc-300";

export function BookRequestModal({ open, onClose }: Props) {
  const [bookTitle, setBookTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setBookTitle("");
    setAuthorName("");
    setMessage("");
    setError(null);
    setDone(false);
    setPending(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = bookTitle.trim();
    const author = authorName.trim();
    if (!title || !author) {
      setError("Book title and author are required.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookTitle: title,
          authorName: author,
          message: message.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => (pending ? null : handleClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-request-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="book-request-title" className="font-serif text-xl font-semibold text-zinc-50">
            Request a Book
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => handleClose()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-zinc-300">
              Thanks! We&apos;ve recorded your request. We share real demand data with publishers to help prioritise
              new titles.
            </p>
            <button
              type="button"
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-500/40 transition hover:bg-amber-500/30"
              onClick={() => handleClose()}
            >
              Close
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label htmlFor="br-title" className={labelClass}>
                Book title <span className="text-red-400">*</span>
              </label>
              <input
                id="br-title"
                name="bookTitle"
                required
                className={inputClass}
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                autoComplete="off"
                placeholder="e.g. The Left Hand of Darkness"
              />
            </div>
            <div>
              <label htmlFor="br-author" className={labelClass}>
                Author name <span className="text-red-400">*</span>
              </label>
              <input
                id="br-author"
                name="authorName"
                required
                className={inputClass}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                autoComplete="off"
                placeholder="e.g. Ursula K. Le Guin"
              />
            </div>
            <div>
              <label htmlFor="br-msg" className={labelClass}>
                Why would you like this book on NovelViz?{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <textarea
                id="br-msg"
                name="message"
                rows={4}
                className={`${inputClass} resize-y`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="A sentence or two is plenty."
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                onClick={() => handleClose()}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
