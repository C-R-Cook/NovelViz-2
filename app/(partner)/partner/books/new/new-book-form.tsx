"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GENRE_OPTIONS } from "@/lib/genre";
import type { BookGenre } from "@db";

export function NewPartnerBookForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState<BookGenre | "">("");
  const [publishedYear, setPublishedYear] = useState("");
  const [description, setDescription] = useState("");
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [applyEpubMetadata, setApplyEpubMetadata] = useState(false);
  const [extractingMetadata, setExtractingMetadata] = useState(false);
  const [metadataErr, setMetadataErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prefillFromEpub(file: File) {
    if (!file.name.toLowerCase().endsWith(".epub")) return;
    setMetadataErr(null);
    setExtractingMetadata(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/partner/books/epub-metadata", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        metadata?: {
          title: string | null;
          author: string | null;
          description: string | null;
          genre: string | null;
          publishedYear: number | null;
        };
      };
      if (!res.ok || !data.metadata) {
        throw new Error(data.error || res.statusText);
      }
      const metadata = data.metadata;

      if (metadata.title) setTitle(metadata.title);
      if (metadata.author) setAuthor(metadata.author);
      if (metadata.genre) {
        const matched = GENRE_OPTIONS.find((opt) => opt.value === metadata.genre);
        if (matched) {
          setGenre(matched.value as BookGenre);
        }
      }
      if (typeof metadata.publishedYear === "number") {
        setPublishedYear(String(metadata.publishedYear));
      }
      if (metadata.description) setDescription(metadata.description);
    } catch (err) {
      setMetadataErr(
        err instanceof Error ? err.message : "Could not extract EPUB metadata",
      );
    } finally {
      setExtractingMetadata(false);
    }
  }

  useEffect(() => {
    if (!applyEpubMetadata || !ingestFile) return;
    if (!ingestFile.name.toLowerCase().endsWith(".epub")) return;
    void prefillFromEpub(ingestFile);
  }, [applyEpubMetadata, ingestFile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const missingRequired: string[] = [];
      if (title.trim() === "") missingRequired.push("title");
      if (author.trim() === "") missingRequired.push("author");
      if (missingRequired.length > 0) {
        throw new Error(`Please provide: ${missingRequired.join(", ")}`);
      }

      const py = publishedYear.trim() === "" ? null : Number.parseInt(publishedYear, 10);
      if (py !== null && Number.isNaN(py)) {
        throw new Error("Published year must be a number");
      }

      const res = await fetch("/api/partner/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          genre: genre === "" ? null : genre,
          publishedYear: py,
          description: description.trim() === "" ? null : description.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: { id: string };
      };
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }

      if (ingestFile) {
        const fd = new FormData();
        fd.append("file", ingestFile);
        fd.append("applyEpubMetadata", applyEpubMetadata ? "true" : "false");
        const ingestRes = await fetch(`/api/admin/books/${data.book.id}/ingest`, {
          method: "POST",
          body: fd,
        });
        const ingestData = (await ingestRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!ingestRes.ok) {
          throw new Error(ingestData.error || ingestRes.statusText);
        }

        const draftRes = await fetch(`/api/partner/books/${data.book.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "draft" }),
        });
        const draftData = (await draftRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!draftRes.ok) {
          throw new Error(draftData.error || draftRes.statusText);
        }
      }

      router.push(`/partner/books/${data.book.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Author
          </span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
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
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
          Description
        </span>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-amber-500/40 dark:focus:ring-amber-400/20"
        />
      </label>
      <div className="space-y-2 rounded-lg border border-zinc-200/90 bg-zinc-50/80 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/35">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
          Optional: Upload EPUB/TXT now
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,application/epub+zip,text/plain"
          className="hidden"
          onChange={(e) => {
            setIngestFile(e.target.files?.[0] ?? null);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 ring-1 ring-zinc-400 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800/90"
          >
            {ingestFile ? "Change file" : "Choose file"}
          </button>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {ingestFile ? ingestFile.name : "No file selected"}
          </span>
        </div>
        <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={applyEpubMetadata}
            onChange={(e) => setApplyEpubMetadata(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-400 text-amber-600 focus:ring-amber-500/30 dark:border-zinc-600"
          />
          <span>
            Fill title/author/description/genre/published year from EPUB metadata
            (ignored for .txt)
          </span>
        </label>
        {extractingMetadata ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Reading EPUB metadata...
          </p>
        ) : null}
        {metadataErr ? (
          <p className="text-xs text-red-600 dark:text-red-400">{metadataErr}</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || extractingMetadata}
        className="rounded-lg bg-amber-100/95 px-4 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-600/40 transition hover:bg-amber-200/90 disabled:opacity-50 dark:bg-amber-200/15 dark:text-amber-100 dark:ring-amber-400/35 dark:hover:bg-amber-200/20"
      >
        {submitting ? "Creating..." : "Create Book"}
      </button>
    </form>
  );
}
