"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EpubMetadataToggle } from "@/components/epub-metadata-toggle";
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
  const [applyEpubMetadata, setApplyEpubMetadata] = useState(true);
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
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Author
          </span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
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
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Published year
          </span>
          <input
            type="number"
            value={publishedYear}
            onChange={(e) => setPublishedYear(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Description
        </span>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <div className="space-y-2 rounded-lg border border-border bg-bg-base/80 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
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
            className="rounded-lg bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised"
          >
            {ingestFile ? "Change file" : "Choose file"}
          </button>
          <span className="text-xs text-text-secondary">
            {ingestFile ? ingestFile.name : "No file selected"}
          </span>
        </div>
        <EpubMetadataToggle
          unlocked={applyEpubMetadata}
          onChange={setApplyEpubMetadata}
          disabled={extractingMetadata}
          id="new-book-epub-metadata-toggle"
        />
        <p className="text-[11px] text-text-muted">Metadata from EPUB is ignored for plain .txt uploads.</p>
        {extractingMetadata ? (
          <p className="text-xs text-text-secondary">
            Reading EPUB metadata...
          </p>
        ) : null}
        {metadataErr ? (
          <p className="text-xs text-error">{metadataErr}</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || extractingMetadata}
        className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Book"}
      </button>
    </form>
  );
}
