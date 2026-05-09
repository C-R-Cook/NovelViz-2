"use client";

import { ChapterManagerClient } from "@/app/admin/books/[id]/chapter-manager-client";
import { GENRE_OPTIONS } from "@/lib/genre";
import { labelListingPreferenceAfterReview } from "@/lib/listing-preference";
import type { BookGenre, BookStatus, ListingPreferenceAfterReview } from "@db";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
      return `${base} bg-bg-raised text-text-primary`;
    case "pending_review":
      return `${base} bg-info text-text-primary`;
    case "rejected":
      return `${base} bg-error text-text-primary`;
    case "processing":
      return `${base} animate-pulse bg-status-processing text-text-primary ring-2 ring-status-processing/40`;
    case "published":
      return `${base} bg-success text-text-primary`;
    case "unlisted":
      return `${base} bg-status-unlisted text-text-primary`;
    default:
      return `${base} bg-bg-raised text-text-primary`;
  }
}

function statusDropdownShellClass(status: BookStatus): string {
  const base =
    "inline-flex h-[34px] w-[10.375rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-1 text-sm font-medium tracking-tight bg-bg-surface";
  switch (status) {
    case "published":
      return `${base} border-success/55 text-text-primary`;
    case "unlisted":
      return `${base} border-status-unlisted/60 text-text-primary`;
    default:
      return `${base} border-border text-text-primary`;
  }
}

function statusActionChipLabel(status: BookStatus): string {
  if (status === "pending_review") return "Pending Review";
  if (status === "published") return "Live";
  if (status === "unlisted") return "Un-listed";
  return status.replace(/_/g, " ");
}

function actionRowGradientClass(status: BookStatus): string {
  switch (status) {
    case "draft":
      return "bg-gradient-to-r from-text-muted/16 via-text-muted/7 to-transparent";
    case "processing":
      return "bg-gradient-to-r from-status-processing/16 via-status-processing/7 to-transparent";
    case "pending_review":
      return "bg-gradient-to-r from-info/16 via-info/7 to-transparent";
    case "rejected":
      return "bg-gradient-to-r from-rose-500/14 via-rose-500/7 to-transparent";
    case "published":
      return "bg-gradient-to-r from-success/14 via-success/6 to-transparent";
    case "unlisted":
      return "bg-gradient-to-r from-status-unlisted/14 via-status-unlisted/6 to-transparent";
    default:
      return "bg-gradient-to-r from-text-muted/10 via-text-muted/4 to-transparent";
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
  const [lockTitle, setLockTitle] = useState(false);
  const [lockAuthor, setLockAuthor] = useState(false);
  const [lockGenre, setLockGenre] = useState(false);
  const [lockYear, setLockYear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestErr, setIngestErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [listingPref, setListingPref] = useState<ListingPreferenceAfterReview>(
    initial.listingPreferenceAfterReview ?? "published",
  );
  const statusPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBook(initial);
    setTitle(initial.title);
    setAuthor(initial.author);
    setGenre((initial.genre ?? "") as BookGenre | "");
    setPublishedYear(initial.publishedYear != null ? String(initial.publishedYear) : "");
    setDescription(initial.description ?? "");
    setListingPref(initial.listingPreferenceAfterReview ?? "published");
    setLockTitle(false);
    setLockAuthor(false);
    setLockGenre(false);
    setLockYear(false);
  }, [initial]);

  useEffect(() => {
    if (book.status !== "processing") return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [book.status, router]);

  useEffect(() => {
    if (book.status !== "draft") setActiveTab("details");
  }, [book.status]);

  useEffect(() => {
    if (!statusPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      const el = statusPickerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setStatusPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [statusPickerOpen]);

  useEffect(() => {
    if (!statusPickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStatusPickerOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [statusPickerOpen]);

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
      fd.append("applyEpubMetadata", "true");
      fd.append("lockTitle", lockTitle ? "true" : "false");
      fd.append("lockAuthor", lockAuthor ? "true" : "false");
      fd.append("lockGenre", lockGenre ? "true" : "false");
      fd.append("lockPublishedYear", lockYear ? "true" : "false");
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
  const canToggleCatalogueStatus = book.status === "published" || book.status === "unlisted";
  const statusLabel = book.status === "published" ? "Live" : "Un-listed";

  /** Single scroll: book form then chapters while still in draft (before submit for review). */
  const mergeBookAndChapterPanels = book.status === "draft";

  return (
    <div className="space-y-6">
      {!mergeBookAndChapterPanels ? (
        <div
          className="flex gap-1 border-b border-border"
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
                ? "border-b-2 border-accent text-text-primary"
                : "text-text-muted hover:text-text-primary"
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
                ? "border-b-2 border-accent text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Chapter Review
          </button>
        </div>
      ) : null}

      <div
        className="flex flex-col gap-2 border-b border-border pb-4"
        aria-label="Book actions"
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${actionRowGradientClass(book.status)}`}
        >
          {canToggleCatalogueStatus ? (
            <div ref={statusPickerRef} className={`${statusDropdownShellClass(book.status)} relative`}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={statusPickerOpen}
                disabled={catalogueActionBusy}
                onClick={() => setStatusPickerOpen((o) => !o)}
                className="flex h-full w-full items-center justify-between gap-2 rounded-lg bg-transparent px-3 py-0.5 text-left text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 text-center">{statusLabel}</span>
                <svg
                  className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${statusPickerOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {statusPickerOpen ? (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-[100] max-h-56 overflow-y-auto rounded-b-lg border border-border bg-bg-surface py-1 shadow-lg shadow-bg-overlay/15 ring-1 ring-border"
                >
                  <li role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={book.status === "published"}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-bg-raised ${
                        book.status === "published" ? "bg-accent-muted text-text-primary" : "text-text-primary"
                      }`}
                      onClick={() => {
                        setStatusPickerOpen(false);
                        if (book.status !== "published") {
                          void transitionStatus("published");
                        }
                      }}
                    >
                      <span>Live</span>
                      {book.status === "published" ? <span className="text-accent">✓</span> : null}
                    </button>
                  </li>
                  <li role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={book.status === "unlisted"}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-bg-raised ${
                        book.status === "unlisted" ? "bg-accent-muted text-text-primary" : "text-text-primary"
                      }`}
                      onClick={() => {
                        setStatusPickerOpen(false);
                        if (book.status !== "unlisted") {
                          void transitionStatus("unlisted");
                        }
                      }}
                    >
                      <span>Un-listed</span>
                      {book.status === "unlisted" ? <span className="text-accent">✓</span> : null}
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : (
            <span className={statusActionChipClass(book.status)}>{statusActionChipLabel(book.status)}</span>
          )}
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
            className="rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
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
                  ? "rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
                  : "rounded-lg bg-info px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-info disabled:opacity-50"
              }
            >
              {statusBusy
                ? "Updating…"
                : book.status === "pending_review"
                  ? "Withdraw from Review"
                  : "Submit for Review"}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Delete ${book.title}`}
            disabled={deleteBusy || statusBusy || ingestBusy}
            onClick={() => void deleteBook()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-error/35 bg-error/15 text-error transition hover:bg-error/25 disabled:cursor-not-allowed disabled:opacity-50"
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
          <fieldset className="space-y-2 rounded-lg border border-border bg-bg-surface/70 px-3 py-2.5">
            <legend className="px-1 text-xs font-medium text-text-secondary">
              When approved by an admin
            </legend>
            <div className="flex flex-col gap-2 text-sm text-text-primary">
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
          <p className="text-xs leading-relaxed text-text-secondary">
            Your request:{" "}
            <span className="font-medium text-text-primary">
              {labelListingPreferenceAfterReview(book.listingPreferenceAfterReview ?? "published")}
            </span>
          </p>
        ) : null}
        {book.status === "rejected" ? (
          <div
            role="alert"
            aria-label="Rejection reason"
            className="rounded-xl border border-error/40 bg-error/10 p-4 text-text-primary"
          >
            <p className="text-sm font-semibold text-error">
              Your book was rejected
            </p>
            {book.rejectionReason ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-error/90">
                {book.rejectionReason}
              </p>
            ) : null}
          </div>
        ) : null}
        {statusErr || deleteErr || ingestErr ? (
          <div className="space-y-1 text-right text-sm text-error">
            {statusErr ? <p>{statusErr}</p> : null}
            {deleteErr ? <p>{deleteErr}</p> : null}
            {ingestErr ? <p>{ingestErr}</p> : null}
          </div>
        ) : null}
      </div>

      {mergeBookAndChapterPanels || activeTab === "details" ? (
        <section className="rounded-xl border border-border bg-bg-surface/85 p-6">
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
                <div className="relative h-52 w-36 overflow-hidden rounded-lg border border-border bg-bg-surface">
                  {book.coverImageUrl ? (
                    <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="144px" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
                      No cover image
                    </div>
                  )}
                </div>
                <div className="w-36 space-y-2">
                  {book.status === "rejected" ? (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-lg bg-error px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-error/40 transition hover:bg-error/90 disabled:opacity-50"
                    >
                      {saving ? "Updating…" : "Resubmit"}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  )}
                  {saveMsg ? <p className="text-sm text-success">{saveMsg}</p> : null}
                  {saveErr ? <p className="text-sm text-error">{saveErr}</p> : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,0.64fr)_14rem]">
                  <div className="space-y-3">
                    <Field
                      label="Title"
                      value={title}
                      onChange={setTitle}
                      required
                      disabled={lockTitle}
                      inputClassName="max-w-[23rem]"
                      suffix={
                        <MetaFieldLockButton
                          locked={lockTitle}
                          onToggle={() => setLockTitle((v) => !v)}
                          label="Lock title metadata"
                        />
                      }
                    />
                    <Field
                      label="Author"
                      value={author}
                      onChange={setAuthor}
                      required
                      disabled={lockAuthor}
                      inputClassName="max-w-[23rem]"
                      suffix={
                        <MetaFieldLockButton
                          locked={lockAuthor}
                          onToggle={() => setLockAuthor((v) => !v)}
                          label="Lock author metadata"
                        />
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
                        Genre
                      </span>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value as BookGenre | "")}
                        disabled={lockGenre}
                        className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                      >
                        <option value="">Select genre</option>
                        {GENRE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <MetaFieldLockButton
                        locked={lockGenre}
                        onToggle={() => setLockGenre((v) => !v)}
                        label="Lock genre metadata"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
                        Year
                      </span>
                      <input
                        type="number"
                        value={publishedYear}
                        onChange={(e) => setPublishedYear(e.target.value)}
                        disabled={lockYear}
                        className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                      />
                      <MetaFieldLockButton
                        locked={lockYear}
                        onToggle={() => setLockYear((v) => !v)}
                        label="Lock year metadata"
                      />
                    </label>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Description
                  </span>
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
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
  disabled = false,
  inputClassName,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  suffix?: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <input
        required={required}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName ?? ""}`}
      />
      {suffix}
    </label>
  );
}

function MetaFieldLockButton({
  locked,
  onToggle,
  label,
}: {
  locked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const baseClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35";
  const stateClass = locked
    ? "text-red-300 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] hover:text-red-200"
    : "text-green-300 drop-shadow-[0_0_6px_rgba(34,197,94,0.8)] hover:text-green-200";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={locked}
      className={`${baseClass} ${stateClass}`}
      title={locked ? "Locked" : "Unlocked"}
    >
      {locked ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 7.6-1.8" />
          <path d="M16 4l3 3" />
        </svg>
      )}
    </button>
  );
}
