"use client";

import { ChapterManagerClient } from "@/app/admin/books/[id]/chapter-manager-client";
import { StatusBadge } from "@/app/admin/books/admin-books-client";
import type { BookStatus } from "@db";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PartnerBookDetailModel = {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  publishedYear: number | null;
  description: string | null;
  coverImageUrl: string | null;
  status: BookStatus;
  rejectionReason: string | null;
  chapterCount: number;
};

export function PartnerBookDetailClient({ book: initial }: { book: PartnerBookDetailModel }) {
  const router = useRouter();
  const ingestFileRef = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [genre, setGenre] = useState(initial.genre ?? "");
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

  useEffect(() => {
    setBook(initial);
    setTitle(initial.title);
    setAuthor(initial.author);
    setGenre(initial.genre ?? "");
    setPublishedYear(initial.publishedYear != null ? String(initial.publishedYear) : "");
    setDescription(initial.description ?? "");
  }, [initial]);

  useEffect(() => {
    if (book.status !== "processing") return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [book.status, router]);

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
          genre: genre.trim() === "" ? null : genre.trim(),
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

  async function transitionStatus(next: BookStatus) {
    setStatusBusy(true);
    setStatusErr(null);
    try {
      const res = await fetch(`/api/partner/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: PartnerBookDetailModel;
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setBook((prev) => ({ ...prev, ...data.book, chapterCount: data.book?.chapterCount ?? prev.chapterCount }));
      router.refresh();
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 dark:border-zinc-800/80 dark:bg-zinc-900/35">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">
          Metadata
        </h2>
        <form onSubmit={saveMetadata} className="mt-4 space-y-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="shrink-0 space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                Cover preview
              </span>
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
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Title" value={title} onChange={setTitle} required />
                <Field label="Author" value={author} onChange={setAuthor} required />
                <Field label="Genre" value={genre} onChange={setGenre} />
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                  Status (read-only)
                </p>
                <div className="mt-1">
                  <StatusBadge status={book.status} />
                </div>
              </div>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Description
            </span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/40 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/35 dark:hover:bg-amber-200/20"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saveMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400/90">{saveMsg}</p> : null}
            {saveErr ? <p className="text-sm text-red-600 dark:text-red-400">{saveErr}</p> : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 dark:border-zinc-800/80 dark:bg-zinc-900/35">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">Ingestion</h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-400">
          Chapters: <span className="font-medium">{book.chapterCount}</span>
        </p>
        <div className="mt-2">
          <StatusBadge status={book.status} />
        </div>
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
          className="mt-4 rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
        >
          {ingestBusy ? "Uploading..." : "Upload EPUB/TXT"}
        </button>
        {ingestErr ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{ingestErr}</p> : null}
      </section>

      <section className="rounded-xl border border-zinc-200/90 bg-white/85 p-6 dark:border-zinc-800/80 dark:bg-zinc-900/35">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100/90">
          Review Request
        </h2>
        <div className="mt-3 space-y-3 text-sm text-zinc-700 dark:text-zinc-400">
          {book.status === "draft" ? (
            <>
              <p>Submit your draft when chapters are ready for review.</p>
              <button
                type="button"
                disabled={statusBusy || book.chapterCount <= 0}
                onClick={() => transitionStatus("pending_review")}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-indigo-50 transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Submit for Review
              </button>
            </>
          ) : null}

          {book.status === "pending_review" ? (
            <>
              <p>Your book is awaiting review.</p>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => transitionStatus("draft")}
                className="rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
              >
                Withdraw from Review
              </button>
            </>
          ) : null}

          {book.status === "rejected" ? (
            <>
              <p>Rejected reason: {book.rejectionReason ?? "No reason provided."}</p>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => transitionStatus("draft")}
                className="rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
              >
                Edit and Resubmit
              </button>
            </>
          ) : null}

          {(book.status === "ready_for_review" || book.status === "published" || book.status === "unlisted") ? (
            <>
              <p>
                Current status: <span className="font-medium">{book.status}</span>.
                {book.status === "ready_for_review"
                  ? " Your book has passed ingestion and is in platform review."
                  : " Visibility can be toggled between published and unlisted."}
              </p>
              {(book.status === "published" || book.status === "unlisted") ? (
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => transitionStatus(book.status === "published" ? "unlisted" : "published")}
                  className="rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
                >
                  {book.status === "published" ? "Set Unlisted" : "Set Published"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {statusErr ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{statusErr}</p> : null}
      </section>

      <ChapterManagerClient bookId={book.id} status={book.status} />
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
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
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
