"use client";

import {
  T2I_TESTER_DEFAULT_IMAGE_SIZE,
  T2I_TESTER_IMAGE_SIZE_OPTIONS,
  T2I_TESTER_MODELS,
  T2I_TESTER_RUNS_PER_PROMPT,
  type T2ITesterModelDef,
} from "@/lib/t2i-tester-config";
import { T2I_PROMPT_PRESETS } from "@/lib/t2i-prompts";
import Image from "next/image";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LS_KEY = "novelviz_t2i_tester_v2";

type BookRow = { id: string; title: string; author: string; chapterCount: number };

export type ResultEntry = {
  status: "loading" | "done" | "error";
  imageUrl?: string;
  imageId?: string;
  chapterNumberAtTime?: number;
  genTimeMs?: number;
  cost?: number;
  bookId?: string;
  error?: string;
  timestamp?: string;
  model?: string;
  prompt?: string;
};

function resultKey(modelId: string, promptIdx: number, runIdx: number): string {
  return `${modelId}:${promptIdx}:${runIdx}`;
}

function parseResultKey(key: string): { modelId: string; promptIdx: number; runIdx: number } | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const promptIdx = Number.parseInt(parts[1]!, 10);
  const runIdx = Number.parseInt(parts[2]!, 10);
  if (!Number.isFinite(promptIdx) || !Number.isFinite(runIdx)) return null;
  return { modelId: parts[0]!, promptIdx, runIdx };
}

export type T2iRowSlide = {
  url: string;
  modelId: string;
  modelLabel: string;
  runIdx: number;
};

/** Completed images for one prompt row, in matrix column order. */
function getT2iRowSlides(results: Record<string, ResultEntry>, promptIdx: number): T2iRowSlide[] {
  const slides: T2iRowSlide[] = [];
  for (const m of T2I_TESTER_MODELS) {
    for (let runIdx = 0; runIdx < T2I_TESTER_RUNS_PER_PROMPT; runIdx++) {
      const key = resultKey(m.id, promptIdx, runIdx);
      const e = results[key];
      if (e?.status === "done" && e.imageUrl) {
        slides.push({ url: e.imageUrl, modelId: m.id, modelLabel: m.label, runIdx });
      }
    }
  }
  return slides;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

const defaultPrompts = Object.values(T2I_PROMPT_PRESETS)[0] ?? [];

const matrixGridClass =
  "grid w-full min-w-[56rem] gap-2 border-b border-border bg-bg-surface/40 py-2 px-1 sm:min-w-[64rem] sm:gap-3 sm:px-2";
const matrixGridCols = "grid-cols-[minmax(10rem,14rem)_repeat(6,minmax(7.5rem,1fr))]";

export default function T2iTesterClient() {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksErr, setBooksErr] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [results, setResults] = useState<Record<string, ResultEntry>>({});
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const [prompts, setPrompts] = useState<string[]>(defaultPrompts);
  const [imageSize, setImageSize] = useState<string>(T2I_TESTER_DEFAULT_IMAGE_SIZE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [presetNonce, setPresetNonce] = useState(0);
  const [lightbox, setLightbox] = useState<{ promptIdx: number; slides: T2iRowSlide[]; index: number } | null>(null);
  const lightboxThumbStripRef = useRef<HTMLDivElement | null>(null);

  const openRowLightbox = useCallback((promptIdx: number, imageUrl: string) => {
    const slides = getT2iRowSlides(results, promptIdx);
    if (slides.length === 0) return;
    const idx = slides.findIndex((s) => s.url === imageUrl);
    setLightbox({ promptIdx, slides, index: idx >= 0 ? idx : 0 });
  }, [results]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { results?: Record<string, ResultEntry>; prompts?: string[]; imageSize?: string };
        if (parsed.results && typeof parsed.results === "object") setResults(parsed.results);
        if (Array.isArray(parsed.prompts) && parsed.prompts.length > 0) setPrompts(parsed.prompts);
        if (typeof parsed.imageSize === "string") setImageSize(parsed.imageSize);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ results, prompts, imageSize }));
    } catch {
      /* ignore */
    }
  }, [results, prompts, imageSize]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((lb) => {
          if (!lb || lb.index <= 0) return lb;
          return { ...lb, index: lb.index - 1 };
        });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((lb) => {
          if (!lb || lb.index >= lb.slides.length - 1) return lb;
          return { ...lb, index: lb.index + 1 };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const id = requestAnimationFrame(() => {
      const strip = lightboxThumbStripRef.current;
      const el = strip?.children[lightbox.index] as HTMLElement | undefined;
      el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [lightbox]);

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
        if (!res.ok) {
          throw new Error(data.error || res.statusText);
        }
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
            return list[0]?.id ?? "";
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

  const matrixStats = useMemo(() => {
    let done = 0;
    let err = 0;
    let totalMs = 0;
    let totalCost = 0;
    let n = 0;
    for (const v of Object.values(results)) {
      if (v.status === "done") {
        done++;
        if (typeof v.genTimeMs === "number") totalMs += v.genTimeMs;
        if (typeof v.cost === "number") totalCost += v.cost;
        n++;
      } else if (v.status === "error") err++;
    }
    const totalCells = prompts.length * T2I_TESTER_MODELS.length * T2I_TESTER_RUNS_PER_PROMPT;
    return {
      done,
      totalCells,
      avgMs: n > 0 ? Math.round(totalMs / n) : 0,
      totalCost,
      err,
    };
  }, [results, prompts.length]);

  const runGeneration = useCallback(
    async (
      model: T2ITesterModelDef,
      promptIdx: number,
      runIdx: number,
      signal?: AbortSignal,
      outputRunId?: string,
    ) => {
      const key = resultKey(model.id, promptIdx, runIdx);
      const prompt = prompts[promptIdx];
      if (!prompt?.trim() || !selectedBookId) return;

      const runSessionId = outputRunId ?? crypto.randomUUID();

      setResults((r) => ({
        ...r,
        [key]: { status: "loading", model: model.label, prompt: prompt.trim() },
      }));

      try {
        const res = await fetch("/api/admin/t2i-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            modelEndpoint: model.endpoint,
            modelLabel: model.label,
            costPerImage: model.costPerImage,
            bookId: selectedBookId,
            imageSize,
            outputRunId: runSessionId,
          }),
          signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          imageUrl?: string;
          imageId?: string;
          chapterNumberAtTime?: number;
          genTimeMs?: number;
          bookId?: string;
        };
        if (!res.ok) {
          setResults((r) => ({
            ...r,
            [key]: {
              status: "error",
              error: typeof data.error === "string" ? data.error : res.statusText,
              model: model.label,
              prompt: prompt.trim(),
              timestamp: new Date().toISOString(),
            },
          }));
          return;
        }
        setResults((r) => ({
          ...r,
          [key]: {
            status: "done",
            imageUrl: data.imageUrl,
            imageId: data.imageId,
            chapterNumberAtTime: data.chapterNumberAtTime,
            genTimeMs: data.genTimeMs,
            cost: model.costPerImage,
            bookId: data.bookId,
            model: model.label,
            prompt: prompt.trim(),
            timestamp: new Date().toISOString(),
          },
        }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setResults((r) => {
            const next = { ...r };
            const cur = next[key];
            if (cur?.status === "loading") delete next[key];
            return next;
          });
          return;
        }
        setResults((r) => ({
          ...r,
          [key]: {
            status: "error",
            error: e instanceof Error ? e.message : "Request failed",
            model: model.label,
            prompt: prompt.trim(),
            timestamp: new Date().toISOString(),
          },
        }));
      }
    },
    [selectedBookId, imageSize, prompts],
  );

  const runAll = useCallback(async () => {
    if (!selectedBookId || prompts.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    const total = prompts.length * T2I_TESTER_MODELS.length * T2I_TESTER_RUNS_PER_PROMPT;
    setProgress({ done: 0, total });
    let done = 0;
    const ac = new AbortController();
    abortControllerRef.current = ac;
    const batchRunId = crypto.randomUUID();

    try {
      outer: for (let pi = 0; pi < prompts.length; pi++) {
        for (const model of T2I_TESTER_MODELS) {
          for (let ri = 0; ri < T2I_TESTER_RUNS_PER_PROMPT; ri++) {
            if (abortRef.current) break outer;
            const key = resultKey(model.id, pi, ri);
            const cur = resultsRef.current[key];
            if (cur?.status === "done") {
              done++;
              setProgress({ done, total });
              continue;
            }
            await runGeneration(model, pi, ri, ac.signal, batchRunId);
            done++;
            setProgress({ done, total });
          }
        }
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
      setProgress(null);
    }
  }, [selectedBookId, prompts, runGeneration]);

  const requestAbort = () => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
  };

  const clearMatrix = () => {
    if (!confirm("Clear all cached matrix results from this browser?")) return;
    setResults({});
  };

  const rerunRow = async (promptIdx: number) => {
    if (!selectedBookId || isRunning) return;
    const rowRunId = crypto.randomUUID();
    for (const model of T2I_TESTER_MODELS) {
      for (let ri = 0; ri < T2I_TESTER_RUNS_PER_PROMPT; ri++) {
        const key = resultKey(model.id, promptIdx, ri);
        setResults((r) => {
          const next = { ...r };
          delete next[key];
          return next;
        });
      }
    }
    for (const model of T2I_TESTER_MODELS) {
      for (let ri = 0; ri < T2I_TESTER_RUNS_PER_PROMPT; ri++) {
        await runGeneration(model, promptIdx, ri, undefined, rowRunId);
      }
    }
  };

  const deleteAllServer = async () => {
    if (
      !confirm(
        "Delete test-model GeneratedImage rows from the database (if any)? Local files under t2i-output/ are not removed.",
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/admin/t2i-test/delete-all", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResults({});
      alert(`Deleted ${data.deleted ?? 0} image(s).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const downloadMatrix = async () => {
    if (isRunning || downloadBusy) return;
    setDownloadBusy(true);

    const OVERALL_MS = 8 * 60_000;
    const BLOB_READ_MS = 120_000;
    const ZIP_MS = 6 * 60_000;

    const ac = new AbortController();
    const overallTimer = window.setTimeout(() => ac.abort(), OVERALL_MS);

    try {
      const manifest: {
        modelId: string;
        modelLabel: string;
        promptIdx: number;
        runIdx: number;
        imageUrl?: string;
        genTimeMs?: number;
        cost?: number;
        chapterNumberAtTime?: number;
      }[] = [];

      type Row = {
        modelId: string;
        modelLabel: string;
        promptIdx: number;
        runIdx: number;
        imageUrl: string;
        v: ResultEntry;
      };
      const rows: Row[] = [];
      for (const [k, v] of Object.entries(results)) {
        if (v.status !== "done" || !v.imageUrl) continue;
        const parsed = parseResultKey(k);
        if (!parsed) continue;
        const model = T2I_TESTER_MODELS.find((m) => m.id === parsed.modelId);
        if (!model) continue;
        rows.push({
          modelId: parsed.modelId,
          modelLabel: model.label,
          promptIdx: parsed.promptIdx,
          runIdx: parsed.runIdx,
          imageUrl: v.imageUrl,
          v,
        });
      }
      rows.sort((a, b) => a.promptIdx - b.promptIdx || a.modelId.localeCompare(b.modelId) || a.runIdx - b.runIdx);

      if (rows.length === 0) {
        alert("No finished images in the matrix to download.");
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < rows.length; i++) {
        if (ac.signal.aborted) {
          throw new DOMException("Download timed out (overall limit).", "AbortError");
        }
        const row = rows[i]!;
        const fname = `novelviz_${row.modelId}_p${row.promptIdx}_r${row.runIdx}.jpg`;
        const res = await fetch(row.imageUrl, { signal: ac.signal, mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error(`Failed to fetch ${fname} (${res.status})`);
        const blob = await withTimeout(res.blob(), BLOB_READ_MS, `Reading ${fname} timed out`);
        zip.file(fname, blob);
        manifest.push({
          modelId: row.modelId,
          modelLabel: row.modelLabel,
          promptIdx: row.promptIdx,
          runIdx: row.runIdx,
          imageUrl: row.imageUrl,
          genTimeMs: row.v.genTimeMs,
          cost: row.v.cost,
          chapterNumberAtTime: row.v.chapterNumberAtTime,
        });
        if (i % 2 === 1) await sleep(0);
      }

      zip.file("novelviz_t2i_matrix_manifest.json", JSON.stringify(manifest, null, 2));

      const zipBlob = await withTimeout(
        zip.generateAsync({ type: "blob", compression: "STORE" }),
        ZIP_MS,
        "Building the ZIP file timed out. Try fewer images or refresh the page.",
      );

      const objectUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "novelviz_t2i_matrix.zip";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "Download stopped: overall time limit (8 min) or the tab was interrupted. Refresh if the button stays disabled."
          : e instanceof Error
            ? e.message
            : "Download failed";
      alert(msg);
    } finally {
      window.clearTimeout(overallTimer);
      setDownloadBusy(false);
    }
  };

  const selectedBook = books.find((b) => b.id === selectedBookId);
  const canRun = Boolean(selectedBookId) && selectedBook && selectedBook.chapterCount > 0 && prompts.length > 0;

  return (
    <>
      <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">T2I Model Tester</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Compare finalist models side by side: each row is one prompt, each column is one model. Outputs save under{" "}
          <code className="text-text-secondary">t2i-output/</code> on the server (model → book → run). Images are not uploaded to Cloudinary
          and are not written to the gallery database.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-surface/80 p-3 sm:gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-text-muted sm:min-w-[16rem]">
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
        <div className="text-xs text-text-muted">
          Matrix: <span className="font-mono text-text-secondary">{T2I_TESTER_MODELS.length}</span> models ×{" "}
          <span className="font-mono text-text-secondary">{prompts.length}</span> prompts
        </div>
        {progress ? (
          <div className="text-xs text-text-secondary">
            Progress:{" "}
            <span className="font-mono text-text-primary">
              {progress.done}/{progress.total}
            </span>
          </div>
        ) : (
          <div className="text-xs text-text-muted">{isRunning ? "Running…" : "Idle"}</div>
        )}
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <button
            type="button"
            disabled={!canRun && !isRunning}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (isRunning) requestAbort();
              else void runAll();
            }}
          >
            {isRunning ? "■ Stop" : "▶ Run all"}
          </button>
          <button
            type="button"
            disabled={downloadBusy || isRunning}
            title="Downloads one .zip (images + manifest). If the button stays grey, wait up to 8 minutes for a timeout or refresh the page."
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary hover:bg-bg-raised disabled:opacity-50"
            onClick={() => void downloadMatrix()}
          >
            ↓ Save matrix
          </button>
          <button
            type="button"
            disabled={isRunning}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary hover:bg-bg-raised disabled:opacity-50"
            onClick={clearMatrix}
          >
            Clear matrix
          </button>
          <button
            type="button"
            disabled={isRunning}
            className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm font-medium text-error hover:bg-error/20 disabled:opacity-50"
            onClick={() => void deleteAllServer()}
          >
            🗑 Delete all test images
          </button>
        </div>
      </div>

      {booksLoading ? (
        <p className="text-sm text-text-muted">Loading books…</p>
      ) : booksErr ? (
        <p className="text-sm text-error">{booksErr}</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-text-secondary">No published books found. Ingest a book first.</p>
      ) : !selectedBookId || (selectedBook && selectedBook.chapterCount === 0) ? (
        <p className="text-sm text-warning">Select a book with at least one chapter to begin.</p>
      ) : null}

      <div className="rounded-xl border border-border bg-bg-surface/60 p-4">
        <div className="flex flex-wrap gap-4 text-xs text-text-secondary sm:text-sm">
          <span>
            Cells done:{" "}
            <span className="font-mono text-text-primary">
              {matrixStats.done}/{matrixStats.totalCells}
            </span>
          </span>
          <span>
            Avg gen: <span className="font-mono text-text-primary">{matrixStats.avgMs} ms</span>
          </span>
          <span>
            Est. cost (matrix): <span className="font-mono text-text-primary">${matrixStats.totalCost.toFixed(3)}</span>
          </span>
          <span>
            Errors: <span className="font-mono text-text-primary">{matrixStats.err}</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Models (columns): {T2I_TESTER_MODELS.map((m) => m.id).join(", ")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-base/20">
        <div className={`${matrixGridClass} ${matrixGridCols} sticky top-0 z-[1] border-b-2 border-border bg-bg-surface`}>
          <div className="flex items-end px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Prompt</div>
          {T2I_TESTER_MODELS.map((m) => (
            <div key={m.id} className="flex min-w-0 flex-col items-center justify-end gap-0.5 px-0.5 pb-1 text-center">
              <span className="w-full truncate text-[11px] font-semibold text-text-primary sm:text-xs" title={m.id}>
                {m.id}
              </span>
              <span
                className="w-full font-mono text-[10px] tabular-nums text-text-muted"
                title={`Est. $/image (${m.description})`}
              >
                ${m.costPerImage.toFixed(3)}
              </span>
            </div>
          ))}
        </div>

        <div className="divide-y divide-border-subtle">
          {prompts.map((promptText, promptIdx) => {
            const keysForRow = T2I_TESTER_MODELS.flatMap((model) =>
              Array.from({ length: T2I_TESTER_RUNS_PER_PROMPT }, (_, runIdx) => resultKey(model.id, promptIdx, runIdx)),
            );
            const rowDone = keysForRow.every((k) => results[k]?.status === "done");
            const rowLoading = keysForRow.some((k) => results[k]?.status === "loading");
            return (
              <div key={promptIdx} className={`${matrixGridClass} ${matrixGridCols} items-stretch bg-bg-base/30 py-3`}>
                <div className="flex min-w-0 flex-col justify-between gap-2 px-1">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Prompt {promptIdx + 1}</p>
                    <p className="mt-1 line-clamp-4 text-xs text-text-primary sm:text-sm">{promptText || "(empty)"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${
                        rowLoading
                          ? "bg-accent-muted text-accent-text"
                          : rowDone
                            ? "bg-success/15 text-success"
                            : "bg-bg-raised text-text-muted"
                      }`}
                    >
                      {rowLoading ? "Running" : rowDone ? "Done" : "Pending"}
                    </span>
                    <button
                      type="button"
                      disabled={isRunning || !canRun}
                      className="rounded border border-border px-2 py-1 text-[10px] text-text-primary hover:bg-bg-raised disabled:opacity-50 sm:text-xs"
                      onClick={() => void rerunRow(promptIdx)}
                    >
                      ↻ Row
                    </button>
                  </div>
                </div>
                {T2I_TESTER_MODELS.flatMap((model) =>
                  Array.from({ length: T2I_TESTER_RUNS_PER_PROMPT }, (_, runIdx) => {
                    const key = resultKey(model.id, promptIdx, runIdx);
                    const entry = results[key];
                    return (
                      <PromptCell
                        key={key}
                        entry={entry}
                        disabled={isRunning || !canRun}
                        onOpenLightbox={(url) => openRowLightbox(promptIdx, url)}
                        onRun={() => void runGeneration(model, promptIdx, runIdx)}
                        onRetry={() => {
                          setResults((r) => {
                            const next = { ...r };
                            delete next[key];
                            return next;
                          });
                          void runGeneration(model, promptIdx, runIdx);
                        }}
                      />
                    );
                  }),
                )}
              </div>
            );
          })}
        </div>
      </div>

      <details className="rounded-xl border border-border bg-bg-surface/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">Configuration</summary>
        <div className="mt-4 space-y-4 border-t border-border-subtle pt-4">
          <div>
            <label className="text-xs font-medium text-text-muted" htmlFor="preset-select">
              Load preset
            </label>
            <select
              key={presetNonce}
              id="preset-select"
              className="mt-1 block w-full max-w-md rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
              defaultValue=""
              onChange={(e) => {
                const name = e.target.value;
                if (!name || !T2I_PROMPT_PRESETS[name]) return;
                setPrompts([...T2I_PROMPT_PRESETS[name]!]);
                setPresetNonce((n) => n + 1);
              }}
            >
              <option value="">Load preset…</option>
              {Object.keys(T2I_PROMPT_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">Defined in lib/t2i-prompts.ts</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Prompts ({prompts.length})</p>
            <ul className="mt-2 space-y-2">
              {prompts.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-6 shrink-0 pt-2 text-xs text-text-muted">{i + 1}</span>
                  <textarea
                    className="min-h-[4rem] flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                    value={p}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPrompts((prev) => prev.map((x, j) => (j === i ? v : x)));
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 self-start rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg-raised hover:text-text-primary"
                    onClick={() => setPrompts((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove prompt ${i + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-accent-text"
              onClick={() => setPrompts((prev) => [...prev, ""])}
            >
              Add prompt
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs text-text-muted">
              Image size
              <select
                className="mt-1 block rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
              >
                {T2I_TESTER_IMAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <p className="max-w-xl text-xs text-text-muted">
              One image per model per prompt. Image size applies to models that use the standard fal{" "}
              <code className="text-text-secondary">image_size</code> string (Grok uses aspect ratio instead).
            </p>
          </div>
        </div>
      </details>
      </div>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Row image preview"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg-overlay/90 p-4 pt-20 backdrop-blur-sm sm:pt-24"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-20 z-[2] rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-raised sm:top-24"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            Close
          </button>
          {(() => {
            const cur = lightbox.slides[lightbox.index];
            if (!cur) return null;
            const n = lightbox.slides.length;
            const atStart = lightbox.index <= 0;
            const atEnd = lightbox.index >= n - 1;
            return (
              <div
                className="flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,1200px)] flex-col gap-2 rounded-xl border border-border bg-bg-surface/95 p-3 shadow-xl sm:gap-3 sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 text-center">
                  <p className="text-sm font-medium text-text-primary">
                    Prompt {lightbox.promptIdx + 1}
                    {prompts[lightbox.promptIdx]?.trim() ? (
                      <span className="mt-1 block line-clamp-2 text-xs font-normal text-text-secondary">
                        {prompts[lightbox.promptIdx]!.trim()}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    <span className="font-medium text-text-primary">{cur.modelLabel}</span>
                    <span className="mx-1.5 text-text-muted">·</span>
                    <span className="tabular-nums">
                      {lightbox.index + 1} / {n}
                    </span>
                    {n > 1 ? <span className="ml-2 hidden sm:inline">← → keys or strip below</span> : null}
                  </p>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    disabled={atStart}
                    aria-label="Previous image"
                    className="shrink-0 rounded-lg border border-border bg-bg-base px-2 py-3 text-sm text-text-primary hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                    onClick={() =>
                      setLightbox((lb) => (lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb))
                    }
                  >
                    ←
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element -- modal preview */}
                  <img
                    src={cur.url}
                    alt=""
                    className="max-h-[min(62vh,720px)] min-h-0 w-auto max-w-[min(78vw,960px)] flex-1 object-contain shadow-lg ring-1 ring-border"
                  />
                  <button
                    type="button"
                    disabled={atEnd}
                    aria-label="Next image"
                    className="shrink-0 rounded-lg border border-border bg-bg-base px-2 py-3 text-sm text-text-primary hover:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                    onClick={() =>
                      setLightbox((lb) =>
                        lb && lb.index < lb.slides.length - 1 ? { ...lb, index: lb.index + 1 } : lb,
                      )
                    }
                  >
                    →
                  </button>
                </div>

                {n > 1 ? (
                  <div className="shrink-0 border-t border-border-subtle pt-2">
                    <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      Row images (scroll)
                    </p>
                    <div
                      ref={lightboxThumbStripRef}
                      className="flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1 pt-0.5 [scrollbar-gutter:stable]"
                    >
                      {lightbox.slides.map((s, i) => (
                        <button
                          key={`${s.modelId}-${s.runIdx}-${i}`}
                          type="button"
                          aria-label={`Show ${s.modelLabel}`}
                          aria-current={i === lightbox.index ? "true" : undefined}
                          className={`relative h-16 w-[4.5rem] shrink-0 overflow-hidden rounded-md ring-2 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                            i === lightbox.index ? "ring-accent" : "ring-border opacity-90 hover:ring-accent/50"
                          }`}
                          onClick={() => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.url} alt="" className="h-full w-full object-cover" />
                          <span className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-bg-overlay/85 px-0.5 py-0.5 text-[9px] font-medium text-text-primary">
                            {s.modelId}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      ) : null}
    </>
  );
}

function PromptCell({
  entry,
  disabled,
  onOpenLightbox,
  onRun,
  onRetry,
}: {
  entry: ResultEntry | undefined;
  disabled: boolean;
  onOpenLightbox: (url: string) => void;
  onRun: () => void;
  onRetry: () => void;
}) {
  if (!entry) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onRun}
        className="group relative flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-border bg-bg-base text-xs text-text-muted transition hover:border-accent hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Run
      </button>
    );
  }
  if (entry.status === "loading") {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-border bg-bg-base">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Loading" />
      </div>
    );
  }
  if (entry.status === "error") {
    return (
      <div className="flex aspect-[3/4] w-full flex-col justify-between rounded-lg border border-error/40 bg-error/5 p-2 text-xs text-error">
        <p className="line-clamp-4">{entry.error ?? "Error"}</p>
        <button type="button" className="mt-2 rounded border border-border px-2 py-1 text-text-primary hover:bg-bg-raised" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-bg-base">
      {entry.imageUrl ? (
        <Image
          src={entry.imageUrl}
          alt=""
          fill
          className="pointer-events-none object-cover"
          sizes="(max-width:768px) 40vw, 160px"
          unoptimized
        />
      ) : null}
      {entry.imageUrl ? (
        <button
          type="button"
          aria-label="View larger"
          className="absolute inset-0 z-[1] cursor-zoom-in bg-transparent"
          onClick={() => onOpenLightbox(entry.imageUrl!)}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[2] bg-bg-overlay/80 opacity-0 transition group-hover:opacity-100">
        <div className="pointer-events-none flex h-full flex-col justify-end gap-1 p-2 text-xs text-text-primary">
          {entry.genTimeMs != null ? <p>{entry.genTimeMs} ms</p> : null}
          {entry.cost != null ? <p>${entry.cost.toFixed(3)}</p> : null}
          {entry.chapterNumberAtTime != null ? <p>Ch. {entry.chapterNumberAtTime}</p> : null}
          <div className="pointer-events-auto mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded bg-bg-surface px-2 py-1 ring-1 ring-border hover:bg-bg-raised"
              onClick={() => onOpenLightbox(entry.imageUrl!)}
            >
              Full size
            </button>
            <a
              href={entry.imageUrl}
              download
              className="rounded bg-bg-surface px-2 py-1 text-text-primary ring-1 ring-border hover:bg-bg-raised"
            >
              Download
            </a>
            <button type="button" className="rounded bg-bg-surface px-2 py-1 ring-1 ring-border hover:bg-bg-raised" onClick={onRetry}>
              Re-run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
