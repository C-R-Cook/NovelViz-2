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
  const [generateCoverAfterCreate, setGenerateCoverAfterCreate] = useState(false);
  const [includeCoverTitleText, setIncludeCoverTitleText] = useState(false);
  const [includeCoverAuthorText, setIncludeCoverAuthorText] = useState(false);
  const [metadataErr, setMetadataErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    title: string;
    author: string;
    status: string;
  } | null>(null);

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

  useEffect(() => {
    if (!generateCoverAfterCreate) {
      setIncludeCoverTitleText(false);
      setIncludeCoverAuthorText(false);
    }
  }, [generateCoverAfterCreate]);

  async function submitBook(confirmDuplicate: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const missingRequired: string[] = [];
      if (title.trim() === "") {
        missingRequired.push(
          generateCoverAfterCreate && includeCoverTitleText
            ? "title (required when including title on the cover)"
            : "title",
        );
      }
      if (author.trim() === "") {
        missingRequired.push(
          generateCoverAfterCreate && includeCoverAuthorText
            ? "author (required when including author on the cover)"
            : "author",
        );
      }
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
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        book?: { id: string };
        duplicateWarning?: boolean;
        existingBook?: { title: string; author: string; status: string };
        message?: string;
      };
      if (res.ok && data.duplicateWarning && data.existingBook) {
        setDuplicateWarning(data.existingBook);
        return;
      }
      if (!res.ok || !data.book) {
        throw new Error(data.error || res.statusText);
      }
      setDuplicateWarning(null);

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

      if (generateCoverAfterCreate) {
        const q = new URLSearchParams({ openCoverAi: "1" });
        if (includeCoverTitleText) q.set("coverIncludeTitle", "1");
        if (includeCoverAuthorText) q.set("coverIncludeAuthor", "1");
        router.push(`/partner/books/${data.book.id}?${q.toString()}`);
      } else {
        router.push(`/partner/books/${data.book.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitBook(false);
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
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,application/epub+zip,text/plain"
          className="hidden"
          onChange={(e) => {
            setIngestFile(e.target.files?.[0] ?? null);
          }}
        />
        <div className="flex flex-wrap items-stretch gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-lg bg-bg-raised px-3 py-2 text-xs font-medium text-text-primary ring-1 ring-border transition hover:bg-bg-raised"
          >
            Select EPUB
          </button>
          <EpubMetadataToggle
            unlocked={applyEpubMetadata}
            onChange={setApplyEpubMetadata}
            disabled={extractingMetadata}
            id="new-book-epub-metadata-toggle"
            showLabel={false}
            className="min-w-[12rem] flex-1"
          />
        </div>
        {ingestFile ? (
          <p className="text-xs text-text-secondary">{ingestFile.name}</p>
        ) : null}
        {extractingMetadata ? (
          <p className="text-xs text-text-secondary">
            Reading EPUB metadata...
          </p>
        ) : null}
        {metadataErr ? (
          <p className="text-xs text-error">{metadataErr}</p>
        ) : null}
      </div>
      {duplicateWarning ? (
        <div
          className="rounded-lg border border-[#C49A3C]/40 bg-[#C49A3C]/10 p-4 space-y-3"
          role="alert"
        >
          <p className="text-sm text-[#C49A3C]">
            A book with this title and author already exists in the catalogue. Are you sure you
            want to add it?
          </p>
          <p className="text-xs text-text-secondary">
            Existing: <span className="text-text-primary">{duplicateWarning.title}</span> by{" "}
            <span className="text-text-primary">{duplicateWarning.author}</span> (status:{" "}
            {duplicateWarning.status})
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDuplicateWarning(null)}
              className="rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm text-text-primary transition hover:bg-bg-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitBook(true)}
              disabled={submitting}
              className="rounded-lg bg-[#C49A3C]/20 px-3 py-1.5 text-sm font-medium text-[#C49A3C] ring-1 ring-[#C49A3C]/40 transition hover:bg-[#C49A3C]/30 disabled:opacity-50"
            >
              Add anyway
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={generateCoverAfterCreate}
            onChange={(e) => setGenerateCoverAfterCreate(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-bg-surface text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">Generate AI Cover Image</span>
        </label>
        <label
          className={`flex items-start gap-2 ${generateCoverAfterCreate ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={includeCoverTitleText}
            disabled={!generateCoverAfterCreate}
            onChange={(e) => setIncludeCoverTitleText(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-bg-surface text-accent focus:ring-accent/25 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-text-secondary">Include Title text</span>
        </label>
        <label
          className={`flex items-start gap-2 ${generateCoverAfterCreate ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={includeCoverAuthorText}
            disabled={!generateCoverAfterCreate}
            onChange={(e) => setIncludeCoverAuthorText(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-bg-surface text-accent focus:ring-accent/25 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-text-secondary">Include Author text</span>
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || extractingMetadata || duplicateWarning !== null}
        className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Book"}
      </button>
    </form>
  );
}
