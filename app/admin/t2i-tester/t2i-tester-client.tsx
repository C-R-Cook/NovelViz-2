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

const LS_KEY = "novelviz_t2i_tester_v1";

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

const tabBase =
  "rounded-t-lg border border-b-0 border-transparent px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:px-4 sm:text-sm";
const tabInactive = "border-transparent text-text-muted hover:text-text-primary";
const tabActive = "border-accent/80 border-border bg-bg-surface font-semibold text-text-primary";

const defaultPrompts = Object.values(T2I_PROMPT_PRESETS)[0] ?? [];

export default function T2iTesterClient() {
  const [activeModelId, setActiveModelId] = useState(T2I_TESTER_MODELS[0]?.id ?? "flux-schnell");
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const openLightbox = useCallback((url: string) => {
    setLightboxUrl(url);
  }, []);

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
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBooksLoading(true);
      setBooksErr(null);
      try {
        const res = await fetch("/api/admin/t2i-test/books");
        const data = (await res.json().catch(() => ({}))) as { books?: BookRow[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error || res.statusText);
        }
        const list = data.books ?? [];
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

  const activeModel = useMemo(
    () => T2I_TESTER_MODELS.find((m) => m.id === activeModelId) ?? T2I_TESTER_MODELS[0]!,
    [activeModelId],
  );

  const tabStats = useMemo(() => {
    const prefix = `${activeModelId}:`;
    let done = 0;
    let err = 0;
    let totalMs = 0;
    let totalCost = 0;
    let n = 0;
    for (const [k, v] of Object.entries(results)) {
      if (!k.startsWith(prefix)) continue;
      if (v.status === "done") {
        done++;
        if (typeof v.genTimeMs === "number") totalMs += v.genTimeMs;
        if (typeof v.cost === "number") totalCost += v.cost;
        n++;
      } else if (v.status === "error") err++;
    }
    const totalCells = prompts.length * T2I_TESTER_RUNS_PER_PROMPT;
    return {
      done,
      totalCells,
      avgMs: n > 0 ? Math.round(totalMs / n) : 0,
      totalCost,
      err,
    };
  }, [results, activeModelId, prompts.length]);

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
    const total = T2I_TESTER_MODELS.length * prompts.length * T2I_TESTER_RUNS_PER_PROMPT;
    setProgress({ done: 0, total });
    let done = 0;
    const ac = new AbortController();
    abortControllerRef.current = ac;
    const batchRunId = crypto.randomUUID();

    try {
      outer: for (const model of T2I_TESTER_MODELS) {
        for (let pi = 0; pi < prompts.length; pi++) {
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

  const clearTab = () => {
    const prefix = `${activeModelId}:`;
    setResults((r) => {
      const next = { ...r };
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix)) delete next[k];
      }
      return next;
    });
  };

  const clearAllResults = () => {
    if (!confirm("Clear all cached results from this browser?")) return;
    setResults({});
  };

  const rerunRow = async (promptIdx: number) => {
    if (!selectedBookId || isRunning) return;
    const rowRunId = crypto.randomUUID();
    for (let ri = 0; ri < T2I_TESTER_RUNS_PER_PROMPT; ri++) {
      const key = resultKey(activeModelId, promptIdx, ri);
      setResults((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
    }
    for (let ri = 0; ri < T2I_TESTER_RUNS_PER_PROMPT; ri++) {
      await runGeneration(activeModel, promptIdx, ri, undefined, rowRunId);
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

  const downloadTab = async () => {
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

      const prefix = `${activeModelId}:`;
      type Row = { promptIdx: number; runIdx: number; imageUrl: string; v: ResultEntry };
      const rows: Row[] = [];
      for (const [k, v] of Object.entries(results)) {
        if (!k.startsWith(prefix) || v.status !== "done" || !v.imageUrl) continue;
        const parsed = parseResultKey(k);
        if (!parsed) continue;
        rows.push({ promptIdx: parsed.promptIdx, runIdx: parsed.runIdx, imageUrl: v.imageUrl, v });
      }
      rows.sort((a, b) => a.promptIdx - b.promptIdx || a.runIdx - b.runIdx);

      if (rows.length === 0) {
        alert("No finished images on this tab to download.");
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < rows.length; i++) {
        if (ac.signal.aborted) {
          throw new DOMException("Download timed out (overall limit).", "AbortError");
        }
        const row = rows[i]!;
        const fname = `novelviz_${activeModelId}_p${row.promptIdx}_r${row.runIdx}.jpg`;
        const res = await fetch(row.imageUrl, { signal: ac.signal, mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error(`Failed to fetch ${fname} (${res.status})`);
        const blob = await withTimeout(res.blob(), BLOB_READ_MS, `Reading ${fname} timed out`);
        zip.file(fname, blob);
        manifest.push({
          modelId: activeModelId,
          modelLabel: activeModel.label,
          promptIdx: row.promptIdx,
          runIdx: row.runIdx,
          imageUrl: row.imageUrl,
          genTimeMs: row.v.genTimeMs,
          cost: row.v.cost,
          chapterNumberAtTime: row.v.chapterNumberAtTime,
        });
        if (i % 2 === 1) await sleep(0);
      }

      zip.file(`novelviz_${activeModelId}_manifest.json`, JSON.stringify(manifest, null, 2));

      const zipBlob = await withTimeout(
        zip.generateAsync({ type: "blob", compression: "STORE" }),
        ZIP_MS,
        "Building the ZIP file timed out. Try fewer images or refresh the page.",
      );

      const objectUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `novelviz_${activeModelId}_tab.zip`;
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
          Generate test images across models. Outputs are saved under <code className="text-text-secondary">t2i-output/</code> on the
          server (model → book → run folder). Images are not uploaded to Cloudinary and are not written to the gallery database.
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
          Runs / prompt: <span className="font-mono text-text-secondary">{T2I_TESTER_RUNS_PER_PROMPT}</span>
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
            onClick={() => void downloadTab()}
          >
            ↓ Save tab
          </button>
          <button
            type="button"
            disabled={isRunning}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary hover:bg-bg-raised disabled:opacity-50"
            onClick={clearTab}
          >
            Clear tab
          </button>
          <button
            type="button"
            disabled={isRunning}
            className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary hover:bg-bg-raised disabled:opacity-50"
            onClick={clearAllResults}
          >
            Clear all
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

      <div className="flex flex-wrap gap-1 border-b border-border">
        {T2I_TESTER_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === activeModelId}
            className={`${tabBase} ${m.id === activeModelId ? tabActive : tabInactive}`}
            onClick={() => setActiveModelId(m.id)}
          >
            {m.id}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-bg-surface/60 p-4">
        <div className="flex flex-wrap gap-4 text-xs text-text-secondary sm:text-sm">
          <span>
            Endpoint: <code className="rounded bg-bg-base px-1 py-0.5 text-text-primary">{activeModel.endpoint}</code>
          </span>
          <span>
            Done:{" "}
            <span className="font-mono text-text-primary">
              {tabStats.done}/{tabStats.totalCells}
            </span>
          </span>
          <span>
            Avg gen: <span className="font-mono text-text-primary">{tabStats.avgMs} ms</span>
          </span>
          <span>
            Est. cost (tab): <span className="font-mono text-text-primary">${tabStats.totalCost.toFixed(3)}</span>
          </span>
          <span>
            Errors: <span className="font-mono text-text-primary">{tabStats.err}</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-text-muted">{activeModel.description}</p>
      </div>

      <div className="space-y-8">
        {prompts.map((promptText, promptIdx) => {
          const runs = Array.from({ length: T2I_TESTER_RUNS_PER_PROMPT }, (_, runIdx) =>
            resultKey(activeModelId, promptIdx, runIdx),
          );
          const rowDone = runs.every((k) => results[k]?.status === "done");
          const rowLoading = runs.some((k) => results[k]?.status === "loading");
          return (
            <div key={promptIdx} className="rounded-xl border border-border bg-bg-base/40 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Prompt {promptIdx + 1}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-text-primary">{promptText || "(empty)"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                    className="rounded border border-border px-2 py-1 text-xs text-text-primary hover:bg-bg-raised disabled:opacity-50"
                    onClick={() => void rerunRow(promptIdx)}
                  >
                    ↻ Row
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {runs.map((key, runIdx) => {
                  const entry = results[key];
                  return (
                    <PromptCell
                      key={key}
                      entry={entry}
                      disabled={isRunning || !canRun}
                      onOpenLightbox={openLightbox}
                      onRun={() => void runGeneration(activeModel, promptIdx, runIdx)}
                      onRetry={() => {
                        setResults((r) => {
                          const next = { ...r };
                          delete next[key];
                          return next;
                        });
                        void runGeneration(activeModel, promptIdx, runIdx);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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
            <p className="text-xs text-text-muted">
              Runs per prompt: {T2I_TESTER_RUNS_PER_PROMPT} (edit <code className="text-text-secondary">lib/t2i-tester-config.ts</code> to
              change)
            </p>
          </div>
        </div>
      </details>
      </div>

      {lightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-overlay/90 p-4 pt-24 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-24 rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-raised sm:top-28"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxUrl(null);
            }}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- unknown dimensions; modal preview */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[min(90vh,1200px)] max-w-[min(95vw,1400px)] object-contain shadow-lg ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          />
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
