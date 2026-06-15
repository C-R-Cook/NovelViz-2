"use client";

import { useCallback, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-bg-surface/80 px-3 py-2 text-sm text-text-primary outline-none ring-accent/20 transition placeholder:text-text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/25";
const labelClass = "block text-sm font-medium text-text-secondary";

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => (pending ? null : handleClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-request-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-bg-base p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="book-request-title" className="font-serif text-xl font-semibold text-text-primary">
            Request a Book
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-text-secondary transition hover:bg-bg-raised hover:text-text-primary"
            onClick={() => handleClose()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              Thanks! We&apos;ve recorded your request. We share real demand data with publishers to help prioritise
              new titles.
            </p>
            <button
              type="button"
              className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-accent-text ring-1 ring-accent/40 transition hover:bg-accent/30"
              onClick={() => handleClose()}
            >
              Close
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label htmlFor="br-title" className={labelClass}>
                Book title <span className="text-error">*</span>
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
                Author name <span className="text-error">*</span>
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
                Additional information{" "}
                <span className="font-normal text-text-muted">(optional)</span>
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
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-raised"
                onClick={() => handleClose()}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-accent disabled:opacity-50"
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
