// TODO: deprecated — functionality moved to /dashboard tabs
"use client";

import { ChapterManagerClient } from "./chapter-manager-client";
import { formatGenre } from "@/lib/genre";
import { labelListingPreferenceAfterReview } from "@/lib/listing-preference";
import type {
  BookGenre,
  BookStatus,
  FeatureRequestStatus,
  ListingPreferenceAfterReview,
} from "@db";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type AdminBookDetailModel = {
  id: string;
  title: string;
  author: string;
  genre: BookGenre | null;
  publishedYear: number | null;
  openLibraryKey: string | null;
  description: string | null;
  coverImageUrl: string | null;
  status: BookStatus;
  rejectionReason: string | null;
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
  ownerLabel: string | null;
  chapterCount: number;
  createdAtLabel: string;
};

export type AdminBookPublicImageRow = {
  id: string;
  imageUrl: string;
  chapterNumberAtTime: number;
  userPrompt: string;
  isFeatured: boolean;
  username: string;
  featureRequest: { id: string; status: FeatureRequestStatus } | null;
  hiddenSpoilerCommentCount: number;
};

type AdminBookTabKey = "details" | "images";

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

export function AdminBookDetailClient({
  book: initial,
  publicImages: initialPublicImages,
}: {
  book: AdminBookDetailModel;
  publicImages: AdminBookPublicImageRow[];
}) {
  const router = useRouter();
  const ingestFileRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
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

  const [publicImages, setPublicImages] = useState(initialPublicImages);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [reviewExpanded, setReviewExpanded] = useState<Record<string, boolean>>({});
  const [reviewRows, setReviewRows] = useState<
    Record<string, { id: string; username: string; content: string; status: string }[]>
  >({});
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminBookTabKey>("details");

  useEffect(() => {
    setPublicImages(initialPublicImages);
  }, [initialPublicImages]);

  async function patchAdminImageFeature(imageId: string, isFeatured: boolean) {
    const snap = publicImages.find((r) => r.id === imageId);
    if (!snap) return;
    setImageBusyId(imageId);
    setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...row, isFeatured } : row)));
    try {
      const res = await fetch(`/api/admin/images/${imageId}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { id: string; isFeatured: boolean };
      setPublicImages((rows) =>
        rows.map((row) => (row.id === data.id ? { ...row, isFeatured: data.isFeatured } : row)),
      );
    } catch {
      setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...snap } : row)));
    } finally {
      setImageBusyId(null);
    }
  }

  async function patchFeatureRequestDecision(
    requestId: string,
    imageId: string,
    action: "approve" | "reject",
  ) {
    const snap = publicImages.find((r) => r.id === imageId);
    if (!snap) return;
    setImageBusyId(imageId);
    const nextFeatured = action === "approve";
    const nextStatus: FeatureRequestStatus =
      action === "approve" ? "APPROVED" : "REJECTED";
    setPublicImages((rows) =>
      rows.map((row) =>
        row.id === imageId
          ? {
              ...row,
              isFeatured: nextFeatured,
              featureRequest: snap.featureRequest
                ? { id: snap.featureRequest.id, status: nextStatus }
                : row.featureRequest,
            }
          : row,
      ),
    );
    try {
      const res = await fetch(`/api/feature-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { id: string; imageId: string; status: FeatureRequestStatus };
      setPublicImages((rows) =>
        rows.map((row) =>
          row.id === data.imageId
            ? {
                ...row,
                isFeatured: data.status === "APPROVED",
                featureRequest: { id: data.id, status: data.status },
              }
            : row,
        ),
      );
    } catch {
      setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...snap } : row)));
    } finally {
      setImageBusyId(null);
    }
  }

  async function removeFeaturedWithOptionalRequest(imageId: string, requestId: string | null) {
    const snap = publicImages.find((r) => r.id === imageId);
    if (!snap) return;
    setImageBusyId(imageId);
    if (requestId) {
      setPublicImages((rows) =>
        rows.map((row) =>
          row.id === imageId ? { ...row, isFeatured: false, featureRequest: null } : row,
        ),
      );
      try {
        const res = await fetch(`/api/feature-requests/${requestId}/remove`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || res.statusText);
        }
      } catch {
        setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...snap } : row)));
      } finally {
        setImageBusyId(null);
      }
      return;
    }
    setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...row, isFeatured: false } : row)));
    try {
      const res = await fetch(`/api/admin/images/${imageId}/feature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: false }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const data = (await res.json()) as { id: string; isFeatured: boolean };
      setPublicImages((rows) =>
        rows.map((row) => (row.id === data.id ? { ...row, isFeatured: data.isFeatured } : row)),
      );
    } catch {
      setPublicImages((rows) => rows.map((row) => (row.id === imageId ? { ...snap } : row)));
    } finally {
      setImageBusyId(null);
    }
  }

  async function loadHiddenCommentsForImage(imageId: string) {
    setReviewLoadingId(imageId);
    try {
      const res = await fetch(`/api/comments?imageId=${encodeURIComponent(imageId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        comments?: { id: string; username: string; content: string; status: string }[];
      };
      const hidden = (data.comments ?? []).filter((c) => c.status === "HIDDEN_SPOILER");
      setReviewRows((prev) => ({ ...prev, [imageId]: hidden }));
    } finally {
      setReviewLoadingId(null);
    }
  }

  async function adminModerateComment(
    commentId: string,
    imageId: string,
    action: "reinstate" | "confirm_spoiler",
    disposition?: "keep" | "delete",
  ) {
    const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "confirm_spoiler" ? { disposition: disposition ?? "keep" } : {}),
      }),
    });
    if (!res.ok) return;
    setReviewRows((prev) => ({
      ...prev,
      [imageId]: (prev[imageId] ?? []).filter((c) => c.id !== commentId),
    }));
    setPublicImages((rows) =>
      rows.map((row) =>
        row.id === imageId
          ? { ...row, hiddenSpoilerCommentCount: Math.max(0, (row.hiddenSpoilerCommentCount ?? 0) - 1) }
          : row,
      ),
    );
  }

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

  async function savePublishedYearOnly() {
    setSaveErr(null);
    setSaveMsg(null);
    setSaving(true);
    try {
      const trimmed = publishedYear.trim();
      const parsed = trimmed === "" ? null : Number.parseInt(trimmed, 10);
      if (parsed !== null) {
        if (Number.isNaN(parsed)) throw new Error("Published year must be a number");
        if (trimmed.length !== 4) throw new Error("Published year must be 4 digits");
      }
      const res = await fetch(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedYear: parsed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: AdminBookDetailModel;
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setBook((prev) => ({ ...prev, ...data.book, chapterCount: prev.chapterCount }));
      setSaveMsg("Published year updated");
      setTimeout(() => setSaveMsg(null), 2500);
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
    const nextStatus: BookStatus =
      book.status === "pending_review"
        ? (book.listingPreferenceAfterReview ?? "published")
        : "published";
    setPublishErr(null);
    setStatusErr(null);
    setActionFeedback(null);
    setPromotingBusy(true);
    setBook((prev) => ({ ...prev, status: nextStatus, rejectionReason: null }));
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
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
      showFeedback("success", nextStatus === "published" ? "Book published." : "Book unlisted.");
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

  const adminActionBusy = statusBusy || promotingBusy || rejectBusy;
  const showRejectButton = book.status === "pending_review";

  return (
    <div className="space-y-6">
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

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Admin book tabs">
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "details"}
          onClick={() => setAdminTab("details")}
          className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
            adminTab === "details"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "images"}
          onClick={() => setAdminTab("images")}
          className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
            adminTab === "images"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Images
        </button>
      </div>

      {adminTab === "details" ? (
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
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
                      Published Year
                    </span>
                    <input
                      type="number"
                      value={publishedYear}
                      onChange={(e) => setPublishedYear(e.target.value)}
                      placeholder="e.g. 1847"
                      className="max-w-[10rem] rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void savePublishedYearOnly()}
                      className="rounded-lg bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Year"}
                    </button>
                  </label>
                </div>
                <InfoRow label="Publisher" value={book.ownerLabel ?? "Unassigned"} />
                <InfoRow label="Uploaded" value={book.createdAtLabel} />
                <InfoRow label="Chapters" value={String(book.chapterCount)} />
                {book.openLibraryKey ? (
                  <div className="sm:col-span-2">
                    <span className="mr-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                      Open Library:
                    </span>
                    <Link
                      href={`https://openlibrary.org${book.openLibraryKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
                    >
                      Open Library ↗
                    </Link>
                  </div>
                ) : null}
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
          <div className="rounded-xl border border-border bg-bg-surface/85 p-6">
            <ChapterManagerClient bookId={book.id} status={book.status} />
          </div>
        </section>
      ) : null}

      {adminTab === "images" ? (
        <section className="rounded-xl border border-border bg-bg-surface/85 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Public images</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Review feature requests, feature images directly for the Discover strip, or remove them from the strip.
          </p>
          {publicImages.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No public images yet.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicImages.map((img) => {
                const fr = img.featureRequest;
                const pending = fr?.status === "PENDING";
                const approved = fr?.status === "APPROVED";
                const rejected = fr?.status === "REJECTED";
                const busy = imageBusyId === img.id;
                const showRemove = Boolean(fr) || img.isFeatured;
                return (
                  <li
                    key={img.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-bg-base/60"
                  >
                    <div className="relative mx-auto aspect-square w-full max-w-[200px] shrink-0 overflow-hidden bg-bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary storage URLs */}
                      <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex min-h-[4.5rem] flex-1 flex-col gap-2 p-3">
                      <p className="text-xs text-text-muted">
                        @{img.username} · Ch. {img.chapterNumberAtTime}
                      </p>
                      <p className="line-clamp-2 text-xs text-text-secondary">{img.userPrompt}</p>
                      <div className="flex flex-wrap gap-2">
                        {img.hiddenSpoilerCommentCount > 0 ? (
                          <span className="rounded-md bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning ring-1 ring-warning/35">
                            {img.hiddenSpoilerCommentCount} under review
                          </span>
                        ) : null}
                        {img.isFeatured ? (
                          <span className="rounded-md bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/35">
                            ★ Featured
                          </span>
                        ) : null}
                        {pending ? (
                          <span className="rounded-md bg-bg-raised px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-border">
                            Request pending
                          </span>
                        ) : null}
                        {approved ? (
                          <span className="rounded-md bg-success/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-primary ring-1 ring-success/35">
                            Approved
                          </span>
                        ) : null}
                        {rejected ? (
                          <span className="rounded-md bg-error/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-error/90 ring-1 ring-error/25">
                            Request rejected
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-auto flex flex-wrap justify-end gap-2">
                        {pending && fr ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchFeatureRequestDecision(fr.id, img.id, "approve")}
                              className="rounded-md bg-success px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary transition hover:bg-success/90 disabled:opacity-50"
                            >
                              {busy ? "…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void patchFeatureRequestDecision(fr.id, img.id, "reject")}
                              className="rounded-md border border-error/40 bg-transparent px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-error transition hover:bg-error/10 disabled:opacity-50"
                            >
                              {busy ? "…" : "Reject"}
                            </button>
                          </>
                        ) : null}
                        {rejected && fr ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void patchFeatureRequestDecision(fr.id, img.id, "approve")}
                            className="rounded-md bg-success px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary transition hover:bg-success/90 disabled:opacity-50"
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                        ) : null}
                        {!img.isFeatured ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void patchAdminImageFeature(img.id, true)}
                            className="rounded-md bg-bg-raised px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary ring-1 ring-border transition hover:bg-bg-surface disabled:opacity-50"
                          >
                            {busy ? "…" : "Feature directly"}
                          </button>
                        ) : null}
                        {showRemove ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void removeFeaturedWithOptionalRequest(img.id, fr?.id ?? null)
                            }
                            className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary ring-1 ring-border transition hover:bg-bg-surface disabled:opacity-50"
                          >
                            {busy ? "…" : "Remove from strip"}
                          </button>
                        ) : null}
                      </div>
                      {img.hiddenSpoilerCommentCount > 0 ? (
                        <div className="mt-2 space-y-2 border-t border-border-subtle pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = !reviewExpanded[img.id];
                              setReviewExpanded((p) => ({ ...p, [img.id]: next }));
                              if (next && !reviewRows[img.id]) void loadHiddenCommentsForImage(img.id);
                            }}
                            className="text-left text-[10px] font-semibold uppercase tracking-wide text-warning underline-offset-2 hover:underline"
                          >
                            {reviewExpanded[img.id] ? "Hide" : "Show"} hidden comments ({img.hiddenSpoilerCommentCount})
                          </button>
                          {reviewExpanded[img.id] ? (
                            <div className="rounded-md border border-border/80 bg-bg-base/80 p-2">
                              {reviewLoadingId === img.id ? (
                                <p className="text-xs text-text-muted">Loading…</p>
                              ) : (
                                <ul className="max-h-48 space-y-2 overflow-y-auto">
                                  {(reviewRows[img.id] ?? []).map((c) => (
                                    <li key={c.id} className="rounded border border-border-subtle bg-bg-surface/80 p-2 text-xs">
                                      <p className="font-medium text-text-primary">@{c.username}</p>
                                      <p className="mt-1 text-text-secondary">{c.content}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => void adminModerateComment(c.id, img.id, "reinstate")}
                                          className="rounded bg-success/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-primary ring-1 ring-success/40"
                                        >
                                          Release
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void adminModerateComment(c.id, img.id, "confirm_spoiler", "keep")}
                                          className="rounded bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning ring-1 ring-warning/35"
                                        >
                                          Keep gated
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void adminModerateComment(c.id, img.id, "confirm_spoiler", "delete")}
                                          className="rounded bg-error/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-error ring-1 ring-error/35"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
