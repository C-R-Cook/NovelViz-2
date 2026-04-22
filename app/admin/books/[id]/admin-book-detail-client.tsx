"use client";

import { ChapterManagerClient } from "./chapter-manager-client";
import { StatusBadge } from "@/app/admin/books/admin-books-client";
import type { BookStatus } from "@db";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type AdminBookDetailModel = {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  publishedYear: number | null;
  description: string | null;
  coverImageUrl: string | null;
  status: BookStatus;
  chapterCount: number;
};

/** Manual status changes only — `processing` is set by ingest, not selectable here. */
const STATUS_OPTIONS: BookStatus[] = [
  "draft",
  "ready_for_review",
  "published",
  "unlisted",
];

/** Human-readable labels: underscores → spaces; first letter capitalised. */
function formatStatusOptionLabel(status: BookStatus): string {
  const spaced = status.replace(/_/g, " ");
  if (spaced.length === 0) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Muted, on-theme tints for the closed select (matches each lifecycle state). */
function statusSelectClassName(status: BookStatus): string {
  const base =
    "w-full cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

  switch (status) {
    case "draft":
      return `${base} border-sky-400/80 bg-sky-100 text-sky-950 focus:border-sky-500/70 focus:ring-sky-400/25 dark:border-sky-600/40 dark:bg-sky-950/60 dark:text-sky-100 dark:focus:border-sky-500/55 dark:focus:ring-sky-500/25`;
    case "processing":
      return `${base} border-violet-400/80 bg-violet-100 text-violet-950 focus:border-violet-500/70 focus:ring-violet-400/25 dark:border-violet-600/45 dark:bg-violet-950/55 dark:text-violet-100 dark:focus:border-violet-500/50 dark:focus:ring-violet-500/25`;
    case "ready_for_review":
      return `${base} border-amber-500/70 bg-amber-100 text-amber-950 focus:border-amber-600/70 focus:ring-amber-400/25 dark:border-amber-600/45 dark:bg-amber-950/50 dark:text-amber-100 dark:focus:border-amber-500/50 dark:focus:ring-amber-500/25`;
    case "published":
      return `${base} border-emerald-500/70 bg-emerald-100 text-emerald-950 focus:border-emerald-600/70 focus:ring-emerald-400/25 dark:border-emerald-600/45 dark:bg-emerald-950/55 dark:text-emerald-100 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25`;
    case "unlisted":
      return `${base} border-rose-500/70 bg-rose-100 text-rose-950 focus:border-rose-600/70 focus:ring-rose-400/25 dark:border-rose-700/40 dark:bg-rose-950/50 dark:text-rose-100 dark:focus:border-rose-600/45 dark:focus:ring-rose-500/22`;
    default:
      return `${base} border-zinc-300 bg-white text-zinc-900 focus:ring-zinc-400/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-500/20`;
  }
}

export function AdminBookDetailClient({ book: initial }: { book: AdminBookDetailModel }) {
  const router = useRouter();
  /** Draft + ready_for_review: upload/re-upload before publishing. */
  const prePublishIngestRef = useRef<HTMLInputElement>(null);
  const reingestFileRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState(initial);

  useEffect(() => {
    setBook(initial);
  }, [initial]);

  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [genre, setGenre] = useState(initial.genre ?? "");
  const [publishedYear, setPublishedYear] = useState(
    initial.publishedYear != null ? String(initial.publishedYear) : "",
  );
  const [description, setDescription] = useState(initial.description ?? "");

  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author);
    setGenre(book.genre ?? "");
    setPublishedYear(book.publishedYear != null ? String(book.publishedYear) : "");
    setDescription(book.description ?? "");
  }, [book]);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [ingestErr, setIngestErr] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  /** When true, ingest applies Dublin Core from the EPUB OPF to this book (ignored for .txt). */
  const [applyEpubMetadata, setApplyEpubMetadata] = useState(false);

  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

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
          genre: genre.trim() === "" ? null : genre,
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

  async function onStatusChange(next: BookStatus) {
    setStatusErr(null);
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
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
      router.refresh();
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function uploadIngest(file: File) {
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

  async function publish() {
    setPublishErr(null);
    setPublishBusy(true);
    try {
      const res = await fetch(`/api/admin/books/${book.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      router.refresh();
    } catch (err) {
      setPublishErr(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/35 dark:shadow-black/20">
        <div className="mb-6 flex flex-col gap-4 border-b border-zinc-200/80 pb-6 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 dark:border-zinc-800/60">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-amber-900 dark:text-amber-100/95">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">{author}</p>
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-2 sm:max-w-[min(100%,18rem)] sm:items-end">
            {book.status !== "processing" &&
            (book.status === "draft" ||
              book.status === "ready_for_review" ||
              book.status === "published" ||
              book.status === "unlisted") ? (
              <label className="flex w-full cursor-pointer items-start gap-2 rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 text-left text-[11px] leading-snug text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-950/40 dark:text-zinc-400 sm:max-w-none">
                <input
                  type="checkbox"
                  checked={applyEpubMetadata}
                  onChange={(e) => setApplyEpubMetadata(e.target.checked)}
                  disabled={ingestBusy || (book.status === "ready_for_review" && publishBusy)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-zinc-400 text-amber-600 focus:ring-amber-500/30 dark:border-zinc-600"
                />
                <span>
                  Fill book metadata from EPUB{" "}
                  <span className="text-zinc-500 dark:text-zinc-500">
                    (title, author, description, genre, published year). No effect on .txt files.
                  </span>
                </span>
              </label>
            ) : null}
            {book.status === "draft" ? (
              <>
                <input
                  ref={prePublishIngestRef}
                  type="file"
                  accept=".epub,.txt,application/epub+zip,text/plain"
                  className="hidden"
                  disabled={ingestBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadIngest(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={ingestBusy}
                  onClick={() => prePublishIngestRef.current?.click()}
                  className="w-full rounded-lg bg-amber-100/95 px-4 py-2 text-center text-sm font-medium text-amber-950 ring-1 ring-amber-600/35 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/10 dark:text-amber-100 dark:ring-amber-400/30 dark:hover:bg-amber-200/15 sm:w-auto"
                >
                  {ingestBusy ? "Uploading…" : "Upload & Ingest (.epub, .txt)"}
                </button>
                <span className="text-center text-xs text-zinc-600 dark:text-zinc-500 sm:text-right">
                  .epub or .txt
                </span>
              </>
            ) : null}
            {book.status === "ready_for_review" ? (
              <>
                <input
                  ref={prePublishIngestRef}
                  type="file"
                  accept=".epub,.txt,application/epub+zip,text/plain"
                  className="hidden"
                  disabled={ingestBusy || publishBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadIngest(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={ingestBusy || publishBusy}
                  onClick={() => prePublishIngestRef.current?.click()}
                  className="w-full rounded-lg bg-amber-100/95 px-4 py-2 text-center text-sm font-medium text-amber-950 ring-1 ring-amber-600/35 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/10 dark:text-amber-100 dark:ring-amber-400/30 dark:hover:bg-amber-200/15 sm:w-auto"
                >
                  {ingestBusy ? "Re-ingesting…" : "Upload & Re-ingest (.epub, .txt)"}
                </button>
                <span className="text-center text-xs text-zinc-600 dark:text-zinc-500 sm:text-right">
                  .epub or .txt
                </span>
              </>
            ) : null}
            {(book.status === "published" || book.status === "unlisted") && (
              <>
                <input
                  ref={reingestFileRef}
                  type="file"
                  accept=".epub,.txt,application/epub+zip,text/plain"
                  className="hidden"
                  disabled={ingestBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadIngest(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={ingestBusy}
                  onClick={() => reingestFileRef.current?.click()}
                  className="w-full rounded-lg bg-amber-100/95 px-4 py-2 text-center text-sm font-medium text-amber-950 ring-1 ring-amber-600/35 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/10 dark:text-amber-100 dark:ring-amber-400/30 dark:hover:bg-amber-200/15 sm:w-auto"
                >
                  {ingestBusy ? "Re-ingesting…" : "Upload & Re-ingest (.epub, .txt)"}
                </button>
                <span className="text-center text-xs text-zinc-600 dark:text-zinc-500 sm:text-right">
                  .epub or .txt
                </span>
              </>
            )}
            {book.status === "processing" ? (
              <p className="max-w-xs text-right text-xs text-blue-800 dark:text-blue-300/90">
                Ingest running — this page refreshes every 5s.
              </p>
            ) : null}
          </div>
        </div>
        <form onSubmit={saveMetadata} className="space-y-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-x-6">
            <div className="shrink-0 space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                Cover preview
              </span>
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
                className="group relative block h-52 w-36 overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100 p-0 text-left outline-none ring-amber-500/0 transition hover:ring-2 hover:ring-amber-500/40 focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:ring-amber-400/35 dark:focus-visible:ring-amber-400/40"
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
                  <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500 dark:text-zinc-600">
                    No cover image
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/65 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="mb-3 rounded-md bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/20 backdrop-blur-[2px]">
                    {coverUploadBusy ? "Uploading…" : "Change cover"}
                  </span>
                </span>
              </button>
              {coverUploadMsg ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400/90">{coverUploadMsg}</p>
              ) : null}
              {coverUploadErr ? (
                <p className="text-xs text-red-600 dark:text-red-400">{coverUploadErr}</p>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Title
                  </span>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-amber-400/0 transition focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Author
                  </span>
                  <input
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Genre
                  </span>
                  <input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                    Published year
                  </span>
                  <input
                    type="number"
                    value={publishedYear}
                    onChange={(e) => setPublishedYear(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
                <div className="space-y-1">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                      Status
                    </span>
                    <select
                      value={book.status}
                      disabled={statusBusy || book.status === "processing"}
                      onChange={(e) =>
                        onStatusChange(e.target.value as BookStatus)
                      }
                      className={statusSelectClassName(book.status)}
                    >
                      {book.status === "processing" ? (
                        <option value="processing">
                          {formatStatusOptionLabel("processing")}
                        </option>
                      ) : null}
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {formatStatusOptionLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {statusErr ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{statusErr}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/40 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/35 dark:hover:bg-amber-200/20 sm:w-auto sm:self-start"
                  >
                    {saving ? "Saving…" : "Save metadata"}
                  </button>
                  {saveMsg ? (
                    <span className="text-sm text-emerald-700 dark:text-emerald-400/90">{saveMsg}</span>
                  ) : null}
                  {saveErr ? (
                    <span className="text-sm text-red-600 dark:text-red-400">{saveErr}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
            />
          </label>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/35 dark:shadow-black/20">
        <h2 className="mb-4 font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">
          Ingestion
        </h2>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-500">Current status</span>
          <StatusBadge status={book.status} />
        </div>

        {book.status === "draft" ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              Use <strong className="font-medium text-zinc-900 dark:text-zinc-200">Upload &amp; Ingest</strong>{" "}
              at the top to add an EPUB or plain-text file (.epub, .txt). It will be split into chapters,
              embedded, and prepared for review. Optionally tick{" "}
              <strong className="font-medium text-zinc-900 dark:text-zinc-200">Fill book metadata from EPUB</strong>{" "}
              before uploading an EPUB to overwrite title, author, and related fields from the file.
            </p>
          </div>
        ) : null}

        {book.status === "processing" ? (
          <div className="flex items-center gap-3 text-sm text-blue-800 dark:text-blue-300/90">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500 ring-2 ring-blue-400/50 dark:bg-blue-400 dark:ring-blue-500/40" />
            Processing text and embeddings… This page refreshes every 5 seconds.
          </div>
        ) : null}

        {book.status === "ready_for_review" ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-300">
                {book.chapterCount}
              </span>{" "}
              chapters ingested. You can replace the source file and re-ingest, or
              publish when satisfied.
            </p>
            <div className="rounded-lg border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100/90">
              <strong className="text-amber-900 dark:text-amber-200">Re-ingest:</strong> Uploading a
              new .epub or .txt replaces all chapters and embeddings. Status stays{" "}
              <code className="text-amber-900 dark:text-amber-50">ready_for_review</code> when
              processing finishes.
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-500">
              Replace the source file with <strong className="font-medium text-zinc-900 dark:text-zinc-200">Upload &amp; Re-ingest</strong>{" "}
              at the top (.epub or .txt).
            </p>
            <button
              type="button"
              disabled={publishBusy || ingestBusy}
              onClick={publish}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white ring-1 ring-emerald-500/50 transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700/85 dark:text-emerald-50 dark:ring-emerald-500/40 dark:hover:bg-emerald-600"
            >
              {publishBusy
                ? "Publishing…"
                : "Looks good — publish to catalogue"}
            </button>
            {publishErr ? (
              <p className="text-sm text-red-600 dark:text-red-400">{publishErr}</p>
            ) : null}
          </div>
        ) : null}

        {(book.status === "published" || book.status === "unlisted") && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-300">
                {book.chapterCount}
              </span>{" "}
              chapters in the database.
            </p>
            <div className="rounded-lg border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100/90">
              <strong className="text-amber-900 dark:text-amber-200">Warning:</strong> Re-ingest
              replaces all existing chapters and vector chunks for this book. The
              book will move to <code className="text-amber-900 dark:text-amber-50">ready_for_review</code>{" "}
              when complete.
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-500">
              Use <strong className="font-medium text-zinc-900 dark:text-zinc-200">Upload &amp; Re-ingest</strong>{" "}
              at the top to replace chapters and embeddings (.epub or .txt).
            </p>
          </div>
        )}

        {ingestErr ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{ingestErr}</p>
        ) : null}
      </section>

      <ChapterManagerClient bookId={book.id} status={book.status} />

      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/35 dark:shadow-black/20">
        <h2 className="mb-3 font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">
          Stats
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-400">
          Chapters:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-200">{book.chapterCount}</span>
        </p>
        <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-500">
          Usage stats coming soon
        </p>
      </section>
    </div>
  );
}
