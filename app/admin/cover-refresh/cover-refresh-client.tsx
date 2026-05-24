"use client";

import type {
  CoverRefreshApplyResult,
  CoverRefreshListRow,
  CoverRefreshScanResult,
} from "@/lib/admin-cover-refresh";
import { adminBookDetailHref } from "@/lib/admin-book-navigation";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SCAN_BATCH = 10;
const APPLY_BATCH = 3;
const BATCH_DELAY_MS = 800;

type ScanById = Record<string, CoverRefreshScanResult>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function CoverRefreshClient({ initialBooks }: { initialBooks: CoverRefreshListRow[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [scanById, setScanById] = useState<ScanById>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"likely-generic" | "ol-available" | "all">("likely-generic");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyLog, setApplyLog] = useState<string[]>([]);

  const scannedCount = Object.keys(scanById).length;
  const scanComplete = scannedCount >= books.length && books.length > 0;

  const visibleBooks = useMemo(() => {
    return books.filter((book) => {
      const scan = scanById[book.id];
      if (filter === "all") return true;
      if (!scan) return filter === "likely-generic" && book.gutenbergId !== null;
      if (filter === "likely-generic") return scan.likelyGenericGutenbergCover;
      return scan.openLibraryCoverAvailable;
    });
  }, [books, filter, scanById]);

  const runScanBatch = useCallback(async (ids: string[]) => {
    const res = await fetch("/api/admin/cover-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", bookIds: ids }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? res.statusText);
    }
    const data = (await res.json()) as { results: CoverRefreshScanResult[] };
    return data.results;
  }, []);

  const scanAll = useCallback(async () => {
    setScanning(true);
    setError(null);
    setScanProgress("Starting scan…");
    try {
      const batches = chunk(books.map((b) => b.id), SCAN_BATCH);
      let done = 0;
      for (const batch of batches) {
        setScanProgress(`Scanning Open Library… ${done}/${books.length}`);
        const results = await runScanBatch(batch);
        setScanById((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.bookId] = r;
          return next;
        });
        done += batch.length;
        if (done < books.length) await sleep(BATCH_DELAY_MS);
      }
      setScanProgress(`Scan complete (${books.length} books).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setScanProgress(null);
    } finally {
      setScanning(false);
    }
  }, [books, runScanBatch]);

  const initialScanStarted = useRef(false);

  useEffect(() => {
    if (initialScanStarted.current || books.length === 0) return;
    initialScanStarted.current = true;
    void scanAll();
  }, [books.length, scanAll]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectMatching(predicate: (scan: CoverRefreshScanResult | undefined, book: CoverRefreshListRow) => boolean) {
    const ids = visibleBooks
      .filter((book) => predicate(scanById[book.id], book))
      .map((b) => b.id);
    setSelected(new Set(ids));
  }

  async function applySelected() {
    const ids = [...selected];
    if (ids.length === 0) return;

    setApplying(true);
    setError(null);
    setApplyLog([]);
    const batches = chunk(ids, APPLY_BATCH);
    let done = 0;
    let ok = 0;
    let fail = 0;

    try {
      for (const batch of batches) {
        setApplyProgress(`Replacing covers… ${done}/${ids.length}`);
        const res = await fetch("/api/admin/cover-refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply", bookIds: batch }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        const data = (await res.json()) as { results: CoverRefreshApplyResult[] };
        for (const r of data.results) {
          if (r.ok && r.coverImageUrl) {
            ok += 1;
            setBooks((prev) =>
              prev.map((b) =>
                b.id === r.bookId ? { ...b, coverImageUrl: r.coverImageUrl!, openLibraryKey: r.openLibraryKey ?? b.openLibraryKey } : b,
              ),
            );
            setScanById((prev) => {
              const existing = prev[r.bookId];
              if (!existing) return prev;
              return {
                ...prev,
                [r.bookId]: {
                  ...existing,
                  likelyGenericGutenbergCover: false,
                },
              };
            });
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(r.bookId);
              return next;
            });
          } else {
            fail += 1;
            setApplyLog((log) => [...log, `${r.bookId}: ${r.error ?? "failed"}`]);
          }
        }
        done += batch.length;
        if (done < ids.length) await sleep(BATCH_DELAY_MS);
      }
      setApplyProgress(`Done. ${ok} updated, ${fail} failed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
      setApplyProgress(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={scanning || applying}
          onClick={() => void scanAll()}
          className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
        >
          {scanning ? "Scanning…" : scanComplete ? "Re-scan Open Library" : "Scan Open Library"}
        </button>
        <button
          type="button"
          disabled={scanning || applying || !scanComplete}
          onClick={() =>
            selectMatching((scan) => Boolean(scan?.likelyGenericGutenbergCover && scan.openLibraryCoverAvailable))
          }
          className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
        >
          Select likely generic (with OL cover)
        </button>
        <button
          type="button"
          disabled={scanning || applying || !scanComplete}
          onClick={() => selectMatching((scan) => Boolean(scan?.openLibraryCoverAvailable))}
          className="rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
        >
          Select all with OL cover
        </button>
        <button
          type="button"
          disabled={scanning || applying}
          onClick={() => setSelected(new Set())}
          className="text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
        >
          Clear selection
        </button>
        <button
          type="button"
          disabled={applying || selected.size === 0 || scanning}
          onClick={() => void applySelected()}
          className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/35 transition hover:bg-accent-hover/80 disabled:opacity-50"
        >
          {applying ? "Replacing…" : `Replace ${selected.size} cover${selected.size === 1 ? "" : "s"} with Open Library`}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["likely-generic", "Likely PG generic"],
            ["ol-available", "OL cover available"],
            ["all", "All pending"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              filter === key
                ? "bg-accent-muted text-text-primary ring-1 ring-accent/40"
                : "bg-bg-raised text-text-secondary ring-1 ring-border hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {scanProgress ? <p className="text-sm text-text-secondary">{scanProgress}</p> : null}
      {applyProgress ? <p className="text-sm text-text-secondary">{applyProgress}</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {applyLog.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto rounded-lg border border-border/80 bg-bg-base/80 p-3 text-xs text-text-muted">
          {applyLog.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-sm text-text-muted">
        {visibleBooks.length} shown · {selected.size} selected · {books.length} pending review total
      </p>

      {visibleBooks.length === 0 ? (
        <p className="text-sm text-text-muted">
          {scanning ? "Loading…" : "No books match this filter. Try re-scan or another filter."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleBooks.map((book) => {
            const scan = scanById[book.id];
            const checked = selected.has(book.id);
            return (
              <li
                key={book.id}
                className={`rounded-xl border p-4 transition ${
                  checked ? "border-accent/50 bg-accent-muted/20" : "border-border/80 bg-bg-base/80"
                }`}
              >
                <label className="flex cursor-pointer flex-wrap items-start gap-4">
                  <input
                    type="checkbox"
                    className="mt-2 shrink-0"
                    checked={checked}
                    disabled={applying || !scan?.openLibraryCoverAvailable}
                    onChange={() => toggle(book.id)}
                  />
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Current</p>
                      <div className="relative h-24 w-16 overflow-hidden rounded border border-border bg-bg-surface">
                        {book.coverImageUrl ? (
                          <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-text-muted">—</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Open Library</p>
                      <div className="relative h-24 w-16 overflow-hidden rounded border border-border bg-bg-surface">
                        {scan?.openLibraryCoverPreviewUrl ? (
                          <Image
                            src={scan.openLibraryCoverPreviewUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : scan ? (
                          <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-muted">
                            No cover
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-text-muted">…</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary">{book.title}</p>
                    <p className="text-sm text-text-secondary">{book.author}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {scan?.likelyGenericGutenbergCover ? (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                          Likely PG generic
                        </span>
                      ) : null}
                      {scan?.openLibraryCoverAvailable ? (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                          OL cover ready
                        </span>
                      ) : scan ? (
                        <span className="rounded-full bg-bg-raised px-2 py-0.5 text-[10px] text-text-muted">
                          No OL cover
                        </span>
                      ) : null}
                      {book.gutenbergId ? (
                        <span className="font-mono text-[10px] text-text-muted">Gutenberg {book.gutenbergId}</span>
                      ) : null}
                    </div>
                    <Link
                      href={adminBookDetailHref(book.id, "/admin/cover-refresh")}
                      className="mt-2 inline-block text-xs text-accent-text underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Book detail
                    </Link>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
