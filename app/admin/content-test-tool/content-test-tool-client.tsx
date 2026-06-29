"use client";

import { SITE_IMAGINE_FAL_MODELS, type ImagineFalModelKey } from "@/lib/imagine-fal-models";
import { useCallback, useEffect, useState } from "react";

type BookRow = {
  id: string;
  title: string;
  author: string;
  chapterCount: number;
};

type ChapterRow = {
  id: string;
  sequenceNumber: number;
  title: string;
  chunkCount: number;
};

type TestResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

type ContentTestToolClientProps = {
  contentTestActive: boolean;
};

function pickDefaultBookId(list: BookRow[]): string {
  const dracula = list.find((b) => b.title === "Dracula");
  if (dracula) return dracula.id;
  const withChapters = list.find((b) => b.chapterCount > 0);
  return withChapters?.id ?? list[0]?.id ?? "";
}

function resolveImageSrc(url: string): string {
  if (url.startsWith("/")) return url;
  return url;
}

function isContentTestStubbed(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { contentTestStubbed?: unknown }).contentTestStubbed === true
  );
}

async function syncReadingProgress(
  bookId: string,
  chapterId: string,
  chapterNumber: number,
): Promise<void> {
  const res = await fetch(`/api/progress/${encodeURIComponent(bookId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterId, chapterNumber }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Failed to sync reading progress");
  }
}

function JsonPane({ result }: { result: TestResult | null }) {
  if (!result) {
    return (
      <p className="text-sm text-text-muted">Submit a test to see the raw response.</p>
    );
  }
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-bg-base p-3 font-mono text-xs text-text-secondary">
      {result.ok
        ? JSON.stringify(result.data, null, 2)
        : JSON.stringify({ status: result.status, ...(result.data as object) }, null, 2)}
    </pre>
  );
}

function StubbedTag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
      [stubbed]
    </span>
  );
}

function QueryPreview({ result }: { result: TestResult | null }) {
  if (!result?.ok) return null;
  const data = result.data as { questionText?: string; responseText?: string };
  if (typeof data.responseText !== "string") {
    return <p className="text-sm text-text-muted">No preview — missing responseText.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Preview</span>
        <StubbedTag show={isContentTestStubbed(result.data)} />
      </div>
      {typeof data.questionText === "string" && data.questionText.length > 0 ? (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">Question:</span> {data.questionText}
        </p>
      ) : null}
      <div className="rounded-xl border border-border bg-bg-base px-4 py-3 text-sm text-text-primary">
        {data.responseText}
      </div>
    </div>
  );
}

function ImaginePreview({ result }: { result: TestResult | null }) {
  if (!result?.ok) return null;
  const data = result.data as {
    imageUrl?: string;
    fullPrompt?: string;
    image?: { userPrompt?: string; imageUrl?: string };
  };
  const imageUrl =
    typeof data.imageUrl === "string"
      ? data.imageUrl
      : typeof data.image?.imageUrl === "string"
        ? data.image.imageUrl
        : null;
  if (!imageUrl) {
    return <p className="text-sm text-text-muted">No preview — missing imageUrl.</p>;
  }
  const userPrompt = data.image?.userPrompt;
  const fullPrompt = data.fullPrompt;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Preview</span>
        <StubbedTag show={isContentTestStubbed(result.data)} />
      </div>
      <img
        src={resolveImageSrc(imageUrl)}
        alt="Generated preview"
        className="max-h-80 w-full rounded-lg border border-border object-contain bg-bg-base"
      />
      {typeof userPrompt === "string" && userPrompt.length > 0 ? (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">User prompt:</span> {userPrompt}
        </p>
      ) : null}
      {typeof fullPrompt === "string" && fullPrompt.length > 0 ? (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">Enriched prompt:</span> {fullPrompt}
        </p>
      ) : null}
    </div>
  );
}

export default function ContentTestToolClient({ contentTestActive }: ContentTestToolClientProps) {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksErr, setBooksErr] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersErr, setChaptersErr] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState("");

  const [questionText, setQuestionText] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [falImagineModel, setFalImagineModel] = useState<ImagineFalModelKey>(
    SITE_IMAGINE_FAL_MODELS[0]?.key ?? "flux-schnell",
  );

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryErr, setQueryErr] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<TestResult | null>(null);

  const [imagineLoading, setImagineLoading] = useState(false);
  const [imagineErr, setImagineErr] = useState<string | null>(null);
  const [imagineResult, setImagineResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBooksLoading(true);
      setBooksErr(null);
      try {
        const res = await fetch(
          "/api/admin/books?filter=published&take=50&sort=title&dir=asc",
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          books?: Array<{ id: string; title: string; author: string; chapterCount: number }>;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || res.statusText);
        const list: BookRow[] = (data.books ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          chapterCount: b.chapterCount,
        }));
        if (!cancelled) {
          setBooks(list);
          setSelectedBookId((prev) => {
            if (prev && list.some((b) => b.id === prev)) return prev;
            return pickDefaultBookId(list);
          });
        }
      } catch (e) {
        if (!cancelled) setBooksErr(e instanceof Error ? e.message : "Failed to load books");
      } finally {
        if (!cancelled) setBooksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      setSelectedChapterId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      setChaptersLoading(true);
      setChaptersErr(null);
      try {
        const res = await fetch(`/api/admin/books/${encodeURIComponent(selectedBookId)}/chapters`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          chapters?: ChapterRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || res.statusText);
        const list = data.chapters ?? [];
        if (!cancelled) {
          setChapters(list);
          setSelectedChapterId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            return list[0]?.id ?? "";
          });
        }
      } catch (e) {
        if (!cancelled) {
          setChapters([]);
          setSelectedChapterId("");
          setChaptersErr(e instanceof Error ? e.message : "Failed to load chapters");
        }
      } finally {
        if (!cancelled) setChaptersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBookId]);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  const runWithProgress = useCallback(
    async (apiCall: () => Promise<Response>): Promise<TestResult> => {
      if (!selectedBookId || !selectedChapter) {
        throw new Error("Select a book and chapter first");
      }
      await syncReadingProgress(
        selectedBookId,
        selectedChapter.id,
        selectedChapter.sequenceNumber,
      );
      const res = await apiCall();
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    [selectedBookId, selectedChapter],
  );

  async function submitQuery() {
    const trimmed = questionText.trim();
    if (!trimmed) {
      setQueryErr("Enter a question");
      return;
    }
    setQueryLoading(true);
    setQueryErr(null);
    setQueryResult(null);
    try {
      const result = await runWithProgress(() =>
        fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: selectedBookId, questionText: trimmed }),
        }),
      );
      setQueryResult(result);
      if (!result.ok) {
        const err = (result.data as { error?: string }).error;
        setQueryErr(err || `Request failed (${result.status})`);
      }
    } catch (e) {
      setQueryErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setQueryLoading(false);
    }
  }

  async function submitImagine() {
    const trimmed = userPrompt.trim();
    if (!trimmed) {
      setImagineErr("Enter an image prompt");
      return;
    }
    setImagineLoading(true);
    setImagineErr(null);
    setImagineResult(null);
    try {
      const result = await runWithProgress(() =>
        fetch("/api/imagine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: selectedBookId,
            userPrompt: trimmed,
            falImagineModel,
          }),
        }),
      );
      setImagineResult(result);
      if (!result.ok) {
        const err = (result.data as { error?: string }).error;
        setImagineErr(err || `Request failed (${result.status})`);
      }
    } catch (e) {
      setImagineErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setImagineLoading(false);
    }
  }

  const controlsDisabled = booksLoading || chaptersLoading || !selectedBookId || !selectedChapterId;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-bg-surface/80 p-4 space-y-4">
        <p className="text-sm text-text-secondary">
          Books without ingested chunks will return empty RAG excerpts — fine for testing moderation
          guards, not retrieval quality.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium uppercase tracking-wide">Book</span>
            <select
              className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              disabled={booksLoading || books.length === 0}
            >
              {books.length === 0 ? <option value="">—</option> : null}
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} — {b.author} ({b.chapterCount} chapters)
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium uppercase tracking-wide">Chapter</span>
            <select
              className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              disabled={controlsDisabled || chapters.length === 0}
            >
              {chapters.length === 0 ? (
                <option value="">—</option>
              ) : (
                chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    Ch. {c.sequenceNumber}: {c.title} ({c.chunkCount} chunks)
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {booksLoading ? (
          <p className="text-sm text-text-muted">Loading books…</p>
        ) : booksErr ? (
          <p className="text-sm text-error">{booksErr}</p>
        ) : chaptersErr ? (
          <p className="text-sm text-error">{chaptersErr}</p>
        ) : null}
        {!contentTestActive ? (
          <p className="text-xs text-text-muted">
            CONTENT_TEST is off in this process — live supplier calls will run when API keys are set.
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-bg-surface/80 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Q&amp;A tester</h2>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          <span className="font-medium uppercase tracking-wide">Question</span>
          <textarea
            className="min-h-[5rem] resize-y rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a question about what you've read so far…"
            disabled={queryLoading}
          />
        </label>
        <button
          type="button"
          disabled={controlsDisabled || queryLoading || !questionText.trim()}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void submitQuery()}
        >
          {queryLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Running…
            </span>
          ) : (
            "Submit query"
          )}
        </button>
        {queryErr ? <p className="text-sm text-error">{queryErr}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Raw JSON
            </span>
            <JsonPane result={queryResult} />
          </div>
          <div>{queryResult ? <QueryPreview result={queryResult} /> : null}</div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-surface/80 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Image tester</h2>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          <span className="font-medium uppercase tracking-wide">Image prompt</span>
          <textarea
            className="min-h-[5rem] resize-y rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Describe a scene, character, or moment…"
            disabled={imagineLoading}
          />
        </label>
        <label className="flex max-w-xs flex-col gap-1 text-xs text-text-muted">
          <span className="font-medium uppercase tracking-wide">fal model (admin)</span>
          <select
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
            value={falImagineModel}
            onChange={(e) => setFalImagineModel(e.target.value as ImagineFalModelKey)}
            disabled={imagineLoading}
          >
            {SITE_IMAGINE_FAL_MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={controlsDisabled || imagineLoading || !userPrompt.trim()}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void submitImagine()}
        >
          {imagineLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Running…
            </span>
          ) : (
            "Submit imagine"
          )}
        </button>
        {imagineErr ? <p className="text-sm text-error">{imagineErr}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Raw JSON
            </span>
            <JsonPane result={imagineResult} />
          </div>
          <div>{imagineResult ? <ImaginePreview result={imagineResult} /> : null}</div>
        </div>
      </section>
    </div>
  );
}
