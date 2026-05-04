"use client";

import { ChapterManagerClient } from "@/app/admin/books/[id]/chapter-manager-client";
import { GENRE_OPTIONS } from "@/lib/genre";
import { labelListingPreferenceAfterReview } from "@/lib/listing-preference";
import type { BookGenre, BookStatus, ListingPreferenceAfterReview } from "@db";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PartnerBookDetailModel = {
  id: string;
  title: string;
  author: string;
  genre: BookGenre | null;
  publishedYear: number | null;
  description: string | null;
  coverImageUrl: string | null;
  status: BookStatus;
  rejectionReason: string | null;
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
  chapterCount: number;
};

type TabKey = "details" | "chapters";

function statusActionChipClass(status: BookStatus): string {
  const base =
    "inline-flex w-[10.375rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium tracking-tight";
  switch (status) {
    case "draft":
      return `${base} bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200`;
    case "pending_review":
      return `${base} bg-indigo-600 text-indigo-50`;
    case "rejected":
      return `${base} bg-red-600 text-red-50`;
    case "processing":
      return `${base} animate-pulse bg-blue-600 text-blue-50 ring-2 ring-blue-400/40`;
    case "published":
      return `${base} bg-emerald-600 text-emerald-50`;
    case "unlisted":
      return `${base} bg-orange-600 text-orange-50`;
    default:
      return `${base} bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200`;
  }
}

function statusActionChipLabel(status: BookStatus): string {
  if (status === "pending_review") return "Pending Review";
  return status.replace(/_/g, " ");
}

function actionRowGradientClass(status: BookStatus): string {
  switch (status) {
    case "draft":
      return "bg-gradient-to-r from-zinc-400/16 via-zinc-400/7 to-transparent dark:from-zinc-500/28 dark:via-zinc-500/12";
    case "processing":
      return "bg-gradient-to-r from-blue-500/16 via-blue-500/7 to-transparent dark:from-blue-500/26 dark:via-blue-500/12";
    case "pending_review":
      return "bg-gradient-to-r from-indigo-500/16 via-indigo-500/7 to-transparent dark:from-indigo-500/26 dark:via-indigo-500/12";
    case "rejected":
      return "bg-gradient-to-r from-rose-500/14 via-rose-500/7 to-transparent dark:from-rose-500/24 dark:via-rose-500/10";
    case "published":
      return "bg-gradient-to-r from-emerald-500/14 via-emerald-500/6 to-transparent dark:from-emerald-500/24 dark:via-emerald-500/10";
    case "unlisted":
      return "bg-gradient-to-r from-orange-500/14 via-orange-500/6 to-transparent dark:from-orange-500/24 dark:via-orange-500/10";
    default:
      return "bg-gradient-to-r from-zinc-400/10 via-zinc-400/4 to-transparent dark:from-zinc-500/14 dark:via-zinc-500/6";
  }
}

export function PartnerBookDetailClient({ book: initial }: { book: PartnerBookDetailModel }) {
  const router = useRouter();
  const ingestFileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [book, setBook] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [genre, setGenre] = useState<BookGenre | "">((initial.genre ?? "") as BookGenre | "");
  const [publishedYear, setPublishedYear] = useState(
    initial.publishedYear != null ? String(initial.publishedYear) : "",
  );
  const [description, setDescription] = useState(initial.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestErr, setIngestErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [listingPref, setListingPref] = useState<ListingPreferenceAfterReview>(
    initial.listingPreferenceAfterReview ?? "published",
  );

  useEffect(() => {
    setBook(initial);
    setTitle(initial.title);
    setAuthor(initial.author);
    setGenre((initial.genre ?? "") as BookGenre | "");
    setPublishedYear(initial.publishedYear != null ? String(initial.publishedYear) : "");
    setDescription(initial.description ?? "");
    setListingPref(initial.listingPreferenceAfterReview ?? "published");
  }, [initial]);

  useEffect(() => {
    if (book.status !== "processing") return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [book.status, router]);

  useEffect(() => {
    if (book.status !== "draft") setActiveTab("details");
  }, [book.status]);

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const py = publishedYear.trim() === "" ? null : Number.parseInt(publishedYear, 10);
      if (py !== null && Number.isNaN(py)) {
        throw new Error("Published year must be a number");
      }
      const res = await fetch(`/api/partner/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          genre: genre === "" ? null : genre,
          publishedYear: py,
          description: description.trim() === "" ? null : description.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: PartnerBookDetailModel;
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setBook((prev) => ({ ...prev, ...data.book, chapterCount: prev.chapterCount }));
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2500);
      router.refresh();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /** Save current fields and move rejected book back to draft (single PATCH). */
  async function resubmitRejectedAsDraft() {
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const py = publishedYear.trim() === "" ? null : Number.parseInt(publishedYear, 10);
      if (py !== null && Number.isNaN(py)) {
        throw new Error("Published year must be a number");
      }
      const res = await fetch(`/api/partner/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          genre: genre === "" ? null : genre,
          publishedYear: py,
          description: description.trim() === "" ? null : description.trim(),
          status: "draft",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: PartnerBookDetailModel;
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setBook((prev) => ({ ...prev, ...data.book, chapterCount: prev.chapterCount }));
      setSaveMsg("Back to draft — you can submit for review when ready.");
      setTimeout(() => setSaveMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Could not resubmit");
    } finally {
      setSaving(false);
    }
  }

  async function uploadIngest(file: File) {
    setIngestBusy(true);
    setIngestErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/books/${book.id}/ingest`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      router.refresh();
    } catch (err) {
      setIngestErr(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setIngestBusy(false);
    }
  }

  async function persistListingPreference(next: ListingPreferenceAfterReview) {
    setListingPref(next);
    if (book.status !== "draft") return;
    setStatusErr(null);
    try {
      const res = await fetch(`/api/partner/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingPreferenceAfterReview: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: PartnerBookDetailModel & { _count?: { chapters?: number } };
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      const updatedBook = data.book;
      setBook((prev) => ({
        ...prev,
        ...updatedBook,
        listingPreferenceAfterReview: updatedBook.listingPreferenceAfterReview ?? next,
        chapterCount: prev.chapterCount,
      }));
      router.refresh();
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : "Could not save choice");
      setListingPref(book.listingPreferenceAfterReview ?? "published");
    }
  }

  async function transitionStatus(next: BookStatus, extra?: Record<string, unknown>) {
    setStatusBusy(true);
    setStatusErr(null);
    try {
      const res = await fetch(`/api/partner/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, ...extra }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: PartnerBookDetailModel;
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setBook((prev) => ({
        ...prev,
        ...data.book,
        chapterCount: data.book?.chapterCount ?? prev.chapterCount,
      }));
      router.refresh();
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function deleteBook() {
    const confirmed = window.confirm(
      `Delete "${book.title}" by ${book.author}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      const res = await fetch(`/api/admin/books/${book.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  const showReviewToggle = book.status === "draft" || book.status === "pending_review";
  const reviewToggleDisabled =
    statusBusy || (book.status === "draft" && book.chapterCount <= 0);
  const catalogueActionBusy = statusBusy || ingestBusy || deleteBusy;

  /** Single scroll: book form then chapters while still in draft (before submit for review). */
  const mergeBookAndChapterPanels = book.status === "draft";

  return (
    <div className="space-y-6">
      {!mergeBookAndChapterPanels ? (
        <div
          className="flex gap-1 border-b border-zinc-200/90 dark:border-zinc-800/80"
          role="tablist"
          aria-label="Partner book tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            onClick={() => setActiveTab("details")}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
              activeTab === "details"
                ? "border-b-2 border-amber-600 text-zinc-900 dark:border-amber-400 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
          >
            Book Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "chapters"}
            onClick={() => setActiveTab("chapters")}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
              activeTab === "chapters"
                ? "border-b-2 border-amber-600 text-zinc-900 dark:border-amber-400 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
          >
            Chapter Review
          </button>
        </div>
      ) : null}

      <div
        className="flex flex-col gap-2 border-b border-zinc-200/90 pb-4 dark:border-zinc-800/80"
        aria-label="Book actions"
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${actionRowGradientClass(book.status)}`}
        >
          <span className={statusActionChipClass(book.status)}>
            {statusActionChipLabel(book.status)}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            ref={ingestFileRef}
            type="file"
            accept=".epub,.txt,application/epub+zip,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadIngest(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={ingestBusy}
            onClick={() => ingestFileRef.current?.click()}
            className="rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
          >
            {ingestBusy ? "Uploading..." : "Re-upload EPUB/TXT"}
          </button>
          {showReviewToggle ? (
            <button
              type="button"
              disabled={reviewToggleDisabled}
              onClick={() =>
                void transitionStatus(
                  book.status === "pending_review" ? "draft" : "pending_review",
                  book.status === "draft"
                    ? { listingPreferenceAfterReview: listingPref }
                    : undefined,
                )
              }
              className={
                book.status === "pending_review"
                  ? "rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
                  : "rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-indigo-50 transition hover:bg-indigo-700 disabled:opacity-50"
              }
            >
              {statusBusy
                ? "Updating…"
                : book.status === "pending_review"
                  ? "Withdraw from Review"
                  : "Submit for Review"}
            </button>
          ) : null}
          {book.status === "published" ? (
            <button
              type="button"
              disabled={catalogueActionBusy}
              onClick={() =>
                void transitionStatus("unlisted")
              }
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-orange-50 transition hover:bg-orange-700 disabled:opacity-50"
            >
              Remove from catalogue
            </button>
          ) : null}
          {book.status === "unlisted" ? (
            <button
              type="button"
              disabled={catalogueActionBusy}
              onClick={() => void transitionStatus("published")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Add to catalogue
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Delete ${book.title}`}
            disabled={deleteBusy || statusBusy || ingestBusy}
            onClick={() => void deleteBook()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300/80 bg-red-100 text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
          </div>
        </div>
        {book.status === "draft" ? (
          <fieldset className="space-y-2 rounded-lg border border-zinc-200/90 bg-white/70 px-3 py-2.5 dark:border-zinc-800/70 dark:bg-zinc-950/40">
            <legend className="px-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              When approved by an admin
            </legend>
            <div className="flex flex-col gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="listing-after-review"
                  checked={listingPref === "published"}
                  onChange={() => void persistListingPreference("published")}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>List in public catalogue</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="listing-after-review"
                  checked={listingPref === "unlisted"}
                  onChange={() => void persistListingPreference("unlisted")}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>Unlisted — live for readers you share with, but not shown in the catalogue</span>
              </label>
            </div>
          </fieldset>
        ) : null}
        {book.status === "pending_review" ? (
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Your request:{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {labelListingPreferenceAfterReview(book.listingPreferenceAfterReview ?? "published")}
            </span>
          </p>
        ) : null}
        {book.status === "rejected" ? (
          <div
            role="alert"
            aria-label="Rejection reason"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/55 dark:text-red-50"
          >
            <p className="text-sm font-semibold text-red-900 dark:text-red-100">
              Your book was rejected
            </p>
            {book.rejectionReason ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-red-900/90 dark:text-red-100/90">
                {book.rejectionReason}
              </p>
            ) : null}
          </div>
        ) : null}
        {statusErr || deleteErr || ingestErr ? (
          <div className="space-y-1 text-right text-sm text-red-600 dark:text-red-400">
            {statusErr ? <p>{statusErr}</p> : null}
            {deleteErr ? <p>{deleteErr}</p> : null}
            {ingestErr ? <p>{ingestErr}</p> : null}
          </div>
        ) : null}
      </div>

      {mergeBookAndChapterPanels || activeTab === "details" ? (
        <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 dark:border-zinc-800/80 dark:bg-zinc-900/35">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (book.status === "rejected") {
                void resubmitRejectedAsDraft();
                return;
              }
              void saveMetadata(e);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[9rem_1fr]">
              <div className="space-y-2">
                {/* TODO: Add partner cover upload endpoint and action. */}
                <div className="relative h-52 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                  {book.coverImageUrl ? (
                    <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="144px" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500 dark:text-zinc-600">
                      No cover image
                    </div>
                  )}
                </div>
                <div className="w-36 space-y-2">
                  {book.status === "rejected" ? (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white ring-1 ring-red-800/40 transition hover:bg-red-800 disabled:opacity-50 dark:bg-red-600 dark:ring-red-500/35 dark:hover:bg-red-500"
                    >
                      {saving ? "Updating…" : "Resubmit"}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/40 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/35 dark:hover:bg-amber-200/20"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  )}
                  {saveMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400/90">{saveMsg}</p> : null}
                  {saveErr ? <p className="text-sm text-red-600 dark:text-red-400">{saveErr}</p> : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="space-y-3">
                    <Field label="Title" value={title} onChange={setTitle} required />
                    <Field label="Author" value={author} onChange={setAuthor} required />
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                        Genre
                      </span>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value as BookGenre | "")}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                      >
                        <option value="">Select genre</option>
                        {GENRE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                        Year
                      </span>
                      <input
                        type="number"
                        value={publishedYear}
                        onChange={(e) => setPublishedYear(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                      />
                    </label>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Description
                  </span>
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                  />
                </label>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      {mergeBookAndChapterPanels ? (
        <div className="mt-8">
          <ChapterManagerClient bookId={book.id} status={book.status} />
        </div>
      ) : activeTab === "chapters" ? (
        <ChapterManagerClient bookId={book.id} status={book.status} />
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
        {label}
      </span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
      />
    </label>
  );
}
