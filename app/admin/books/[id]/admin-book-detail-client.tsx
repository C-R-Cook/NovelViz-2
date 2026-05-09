// TODO: deprecated — functionality moved to /dashboard tabs
"use client";

import { ChapterManagerClient } from "./chapter-manager-client";
import { EpubMetadataToggle } from "@/components/epub-metadata-toggle";
import { formatGenre, GENRE_OPTIONS } from "@/lib/genre";
import { labelListingPreferenceAfterReview } from "@/lib/listing-preference";
import type { BookGenre } from "@db";
import type { BookStatus } from "@db";
import type { ListingPreferenceAfterReview } from "@db";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type AdminBookDetailModel = {
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
  ownerLabel: string | null;
  chapterCount: number;
  createdAtLabel: string;
};

type TabKey = "overview" | "edit";

/** Status tint behind overview / edit content panels (admins infer meaning from colour). */
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

export function AdminBookDetailClient({ book: initial }: { book: AdminBookDetailModel }) {
  const router = useRouter();
  const ingestFileRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [book, setBook] = useState(initial);

  useEffect(() => {
    setBook(initial);
  }, [initial]);

  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [genre, setGenre] = useState<BookGenre | "">((initial.genre ?? "") as BookGenre | "");
  const [publishedYear, setPublishedYear] = useState(
    initial.publishedYear != null ? String(initial.publishedYear) : "",
  );
  const [description, setDescription] = useState(initial.description ?? "");

  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author);
    setGenre((book.genre ?? "") as BookGenre | "");
    setPublishedYear(book.publishedYear != null ? String(book.publishedYear) : "");
    setDescription(book.description ?? "");
  }, [book]);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Publish / Unlist (green button) — keeps UI in sync; separate loading from review Submit/Withdraw. */
  const [promotingBusy, setPromotingBusy] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectErr, setRejectErr] = useState<string | null>(null);

  function showFeedback(kind: "success" | "error", message: string) {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setActionFeedback({ kind, message });
    feedbackTimerRef.current = setTimeout(() => {
      setActionFeedback(null);
      feedbackTimerRef.current = null;
    }, 4000);
  }

  const [ingestErr, setIngestErr] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  /** When true, ingest applies Dublin Core from the EPUB OPF to this book. */
  const [applyEpubMetadata, setApplyEpubMetadata] = useState(false);

  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [coverUploadBusy, setCoverUploadBusy] = useState(false);
  const [coverUploadErr, setCoverUploadErr] = useState<string | null>(null);
  const [coverUploadMsg, setCoverUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    if (book.status !== "processing") return;
    const id = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [book.status, router]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    setSaveMsg(null);
    setSaving(true);
    try {
      const py =
        publishedYear.trim() === "" ? null : parseInt(publishedYear, 10);
      if (py !== null && Number.isNaN(py)) {
        throw new Error("Published year must be a number");
      }
      const res = await fetch(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          genre: genre === "" ? null : genre,
          publishedYear: py,
          description: description.trim() === "" ? null : description,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { book: AdminBookDetailModel };
      setBook((prev) => ({
        ...prev,
        ...data.book,
        chapterCount: prev.chapterCount,
      }));
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 3000);
      router.refresh();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function transitionStatus(
    next: BookStatus,
    options?: { successMessage?: string },
  ) {
    const snapshot = { ...book };
    setStatusErr(null);
    setPublishErr(null);
    setActionFeedback(null);
    setStatusBusy(true);
    setBook((prev) => ({
      ...prev,
      status: next,
      rejectionReason: next === "rejected" ? prev.rejectionReason : null,
    }));
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: AdminBookDetailModel & Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (data.book) {
        setBook((prev) => ({
          ...prev,
          ...(data.book as Partial<AdminBookDetailModel>),
          chapterCount: prev.chapterCount,
          ownerLabel: prev.ownerLabel,
          createdAtLabel: prev.createdAtLabel,
        }));
      }
      showFeedback(
        "success",
        options?.successMessage ??
          (next === "pending_review"
            ? "Submitted for review."
            : next === "draft"
              ? "Withdrawn from review."
              : next === "unlisted"
                ? "Book unlisted."
                : "Status updated."),
      );
      router.refresh();
    } catch (err) {
      setBook(snapshot);
      const msg = err instanceof Error ? err.message : "Update failed";
      setStatusErr(msg);
      showFeedback("error", msg);
    } finally {
      setStatusBusy(false);
    }
  }

  async function promoteToPublished() {
    const snapshot = { ...book };
    setPublishErr(null);
    setStatusErr(null);
    setActionFeedback(null);
    setPromotingBusy(true);
    setBook((prev) => ({ ...prev, status: "published", rejectionReason: null }));
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: AdminBookDetailModel & Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (data.book) {
        setBook((prev) => ({
          ...prev,
          ...(data.book as Partial<AdminBookDetailModel>),
          chapterCount: prev.chapterCount,
          ownerLabel: prev.ownerLabel,
          createdAtLabel: prev.createdAtLabel,
        }));
      }
      showFeedback("success", "Book published.");
      router.refresh();
    } catch (err) {
      setBook(snapshot);
      const msg = err instanceof Error ? err.message : "Publish failed";
      setPublishErr(msg);
      showFeedback("error", msg);
    } finally {
      setPromotingBusy(false);
    }
  }

  async function confirmRejection() {
    const trimmed = rejectReason.trim();
    if (trimmed.length < 20) {
      setRejectErr("Reason for rejection must be at least 20 characters.");
      return;
    }
    const snapshot = { ...book };
    setRejectErr(null);
    setStatusErr(null);
    setPublishErr(null);
    setActionFeedback(null);
    setRejectBusy(true);
    setStatusBusy(true);
    setBook((prev) => ({ ...prev, status: "rejected", rejectionReason: trimmed }));
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", rejectionReason: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: AdminBookDetailModel & Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (data.book) {
        setBook((prev) => ({
          ...prev,
          ...(data.book as Partial<AdminBookDetailModel>),
          chapterCount: prev.chapterCount,
          ownerLabel: prev.ownerLabel,
          createdAtLabel: prev.createdAtLabel,
        }));
      }
      setRejectOpen(false);
      setRejectReason("");
      showFeedback("success", "Book rejected.");
      router.refresh();
    } catch (err) {
      setBook(snapshot);
      const msg = err instanceof Error ? err.message : "Rejection failed";
      setRejectErr(msg);
      showFeedback("error", msg);
    } finally {
      setRejectBusy(false);
      setStatusBusy(false);
    }
  }

  async function uploadIngest(file: File) {
    const name = file.name.toLowerCase();
    const isEpub =
      name.endsWith(".epub") ||
      file.type === "application/epub+zip" ||
      file.type === "application/x-epub+zip";
    if (!isEpub) {
      setIngestErr("Only EPUB files are supported.");
      return;
    }
    setIngestErr(null);
    setIngestBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("applyEpubMetadata", applyEpubMetadata ? "true" : "false");
      const res = await fetch(`/api/admin/books/${book.id}/ingest`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      router.refresh();
    } catch (err) {
      setIngestErr(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setIngestBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setCoverUploadErr(null);
    setCoverUploadMsg(null);
    setCoverUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/books/${book.id}/cover`, {
        method: "POST",
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: AdminBookDetailModel;
      };
      if (!res.ok) {
        throw new Error(j.error || res.statusText);
      }
      if (j.book) {
        setBook((prev) => ({
          ...prev,
          ...j.book,
          chapterCount: prev.chapterCount,
        }));
      }
      setCoverUploadMsg("Cover updated");
      setTimeout(() => setCoverUploadMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setCoverUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCoverUploadBusy(false);
      if (coverUploadRef.current) coverUploadRef.current.value = "";
    }
  }

  async function deleteBook() {
    const confirmed = window.confirm(
      `Delete "${book.title}" by ${book.author}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleteErr(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${book.id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error || res.statusText);
      }
      router.push("/dashboard?tab=all-books");
      router.refresh();
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  const showReviewToggle = book.status === "draft" || book.status === "pending_review";
  const reviewToggleDisabled =
    statusBusy ||
    promotingBusy ||
    rejectBusy ||
    (book.status === "draft" && book.chapterCount <= 0);
  const adminActionBusy = statusBusy || promotingBusy || rejectBusy;
  const showRejectButton = book.status === "pending_review";

  return (
    <div className="space-y-6">
      <div
        className="flex gap-1 border-b border-border"
        role="tablist"
        aria-label="Admin book tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
            activeTab === "overview"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "edit"}
          onClick={() => setActiveTab("edit")}
          className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
            activeTab === "edit"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Edit
        </button>
      </div>

      <div
        className="sticky top-0 z-20 space-y-2 rounded-xl border border-border bg-bg-surface/95 p-3 shadow-sm backdrop-blur-sm"
        aria-label="Book actions"
      >
        <div
          className={`flex flex-wrap items-center justify-end gap-2 rounded-lg px-2 py-2 ${actionRowGradientClass(book.status)}`}
        >
            {(book.status === "pending_review" || book.status === "published" || book.status === "unlisted") ? (
              <>
                {showRejectButton ? (
                  <button
                    type="button"
                    disabled={adminActionBusy || ingestBusy}
                    onClick={() => {
                      setRejectReason("");
                      setRejectErr(null);
                      setRejectOpen(true);
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={promotingBusy || ingestBusy || statusBusy || rejectBusy}
                  onClick={() =>
                    book.status === "published"
                      ? void transitionStatus("unlisted", { successMessage: "Book unlisted." })
                      : void promoteToPublished()
                  }
                  className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-success disabled:opacity-50"
                >
                  {promotingBusy
                    ? "Updating…"
                    : book.status === "published"
                      ? "Remove from catalogue"
                      : book.status === "unlisted"
                        ? "Add to catalogue"
                        : "Publish"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              aria-label={`Delete ${book.title}`}
              disabled={deleteBusy || statusBusy || ingestBusy || promotingBusy || rejectBusy}
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
        {actionFeedback ? (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              actionFeedback.kind === "success"
                ? "bg-success/15 text-text-primary ring-1 ring-success/35"
                : "bg-error/15 text-text-primary ring-1 ring-error/35"
            }`}
          >
            {actionFeedback.message}
          </div>
        ) : null}
        {statusErr || publishErr || deleteErr ? (
          <div className="space-y-1 text-right text-sm text-error">
            {statusErr ? <p>{statusErr}</p> : null}
            {publishErr ? <p>{publishErr}</p> : null}
            {deleteErr ? <p>{deleteErr}</p> : null}
          </div>
        ) : null}
      </div>

      {activeTab === "overview" ? (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-border p-6">
            <div
              className={`pointer-events-none absolute inset-0 ${actionRowGradientClass(book.status)}`}
              aria-hidden
            />
            <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-[9rem_1fr] rounded-lg bg-bg-surface/80 p-1">
              <div className="relative h-52 w-36 overflow-hidden rounded-lg border border-border bg-bg-surface">
                {book.coverImageUrl ? (
                  <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="144px" />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
                    No cover image
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow label="Title" value={book.title} />
                <InfoRow label="Author" value={book.author} />
                <InfoRow label="Genre" value={book.genre ? formatGenre(book.genre) : "Unknown"} />
                <InfoRow label="Year" value={book.publishedYear != null ? String(book.publishedYear) : "Unknown"} />
                <InfoRow label="Publisher" value={book.ownerLabel ?? "Unassigned"} />
                <InfoRow label="Uploaded" value={book.createdAtLabel} />
                <InfoRow label="Chapters" value={String(book.chapterCount)} />
                {book.status === "pending_review" ? (
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Partner visibility request"
                      value={labelListingPreferenceAfterReview(
                        book.listingPreferenceAfterReview ?? "published",
                      )}
                    />
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <InfoRow label="Description" value={book.description ?? "No description"} multiline />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "edit" ? (
        <section className="space-y-4">
          {showReviewToggle ? (
            <div className="rounded-lg border border-border bg-bg-base/80 p-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={reviewToggleDisabled}
                  onClick={() =>
                    void transitionStatus(book.status === "pending_review" ? "draft" : "pending_review", {
                      successMessage:
                        book.status === "pending_review"
                          ? "Withdrawn from review."
                          : "Submitted for review.",
                    })
                  }
                  className={
                    book.status === "pending_review"
                      ? "rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
                      : "rounded-lg bg-info px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-info disabled:opacity-50"
                  }
                >
                  {statusBusy ? "Updating..." : book.status === "pending_review" ? "Withdraw Review" : "Submit Review"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-xl border border-border p-6">
            <div
              className={`pointer-events-none absolute inset-0 ${actionRowGradientClass(book.status)}`}
              aria-hidden
            />
            <form
              onSubmit={saveMetadata}
              className="relative z-10 space-y-4 rounded-lg bg-bg-surface/80 p-1"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[9rem_1fr]">
                <div className="w-36 space-y-2">
                  <input
                    ref={ingestFileRef}
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadIngest(f);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={coverUploadRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={coverUploadBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadCover(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={coverUploadBusy}
                    onClick={() => !coverUploadBusy && coverUploadRef.current?.click()}
                    className="group relative block h-52 w-full overflow-hidden rounded-lg border border-border bg-bg-surface p-0 text-left outline-none ring-accent/0 transition hover:ring-2 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={coverUploadBusy ? "Uploading cover" : "Change cover image"}
                  >
                    {book.coverImageUrl ? (
                      <Image
                        src={book.coverImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="144px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
                        No cover image
                      </div>
                    )}
                    <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-bg-overlay/65 via-bg-overlay/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="mb-3 rounded-md bg-bg-base/55 px-2.5 py-1 text-[11px] font-medium text-text-primary ring-1 ring-white/20 backdrop-blur-[2px]">
                        {coverUploadBusy ? "Uploading…" : "Change cover"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={ingestBusy}
                    onClick={() => ingestFileRef.current?.click()}
                    className="w-full rounded-lg bg-bg-raised px-2 py-2 text-center text-xs font-medium leading-snug text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
                  >
                    {ingestBusy ? "Uploading…" : "Re-upload EPUB"}
                  </button>
                  <EpubMetadataToggle
                    unlocked={applyEpubMetadata}
                    onChange={setApplyEpubMetadata}
                    disabled={ingestBusy}
                    id="admin-book-ingest-metadata-toggle"
                  />
                  {ingestErr ? <p className="text-xs text-error">{ingestErr}</p> : null}
                  {coverUploadMsg ? (
                    <p className="text-xs text-success">{coverUploadMsg}</p>
                  ) : null}
                  {coverUploadErr ? (
                    <p className="text-xs text-error">{coverUploadErr}</p>
                  ) : null}
                </div>

                <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="space-y-3">
                    <Field label="Title" value={title} onChange={setTitle} required />
                    <Field label="Author" value={author} onChange={setAuthor} required />
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
                        Genre
                      </span>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value as BookGenre | "")}
                        className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
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
                      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
                        Year
                      </span>
                      <input
                        type="number"
                        value={publishedYear}
                        onChange={(e) => setPublishedYear(e.target.value)}
                        className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
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
                <div className="w-36 space-y-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  {saveMsg ? <p className="text-sm text-success">{saveMsg}</p> : null}
                  {saveErr ? <p className="text-sm text-error">{saveErr}</p> : null}
                </div>
              </div>
              </div>
            </form>
          </div>

          <div className="mt-10 border-t border-border pt-8">
            <ChapterManagerClient bookId={book.id} status={book.status} />
          </div>
        </section>
      ) : null}

      {rejectOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-reject-book-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setRejectOpen(false);
              setRejectReason("");
              setRejectErr(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-bg-surface p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="admin-reject-book-title" className="text-lg font-semibold text-text-primary">
              Reject Book
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              This will notify the partner and set the book back to draft
            </p>
            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">
                Reason for rejection
              </span>
              <textarea
                rows={5}
                value={rejectReason}
                autoFocus
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                placeholder="Explain what needs to change (minimum 20 characters)."
              />
            </label>
            <p className="mt-1 text-xs text-text-secondary">
              {rejectReason.trim().length < 20
                ? `${20 - rejectReason.trim().length} more character${20 - rejectReason.trim().length === 1 ? "" : "s"} required`
                : "Ready to confirm"}
            </p>
            {rejectErr ? <p className="mt-2 text-sm text-error">{rejectErr}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={rejectBusy}
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason("");
                  setRejectErr(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-base disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectBusy}
                onClick={() => void confirmRejection()}
                className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-text-primary shadow-sm ring-1 ring-error/35 transition hover:bg-error disabled:pointer-events-none disabled:opacity-50"
              >
                {rejectBusy ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={`${multiline ? "" : "min-h-[1.75rem]"}`}>
      <p className={`text-sm text-text-primary ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}>
        <span className="mr-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}:
        </span>
        {value}
      </p>
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
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
      />
    </label>
  );
}
