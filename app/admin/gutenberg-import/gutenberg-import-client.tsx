"use client";

import { GutenbergSectionNav } from "@/components/admin/gutenberg-section-nav";
import { parseGutenbergTab, type GutenbergImportTab } from "@/lib/gutenberg-admin-nav";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deferReasonLabel,
  formatEpubSize,
  ingestSkipReasonLabel,
} from "@/scripts/lib/gutenberg-queue-flags";
import type { DeferredQueueEntry, GutenbergDeferredFile } from "@/scripts/lib/gutenberg-deferred";
import { INGEST_DEFER_NO_EPUB, INGEST_SKIP_EPUB_TOO_LARGE } from "@/scripts/lib/gutenberg-types";
import type { DeferReason, GutenbergQueueFile, QueueEntry } from "@/scripts/lib/gutenberg-types";

type QueueState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      queue: GutenbergQueueFile;
      entries: QueueEntry[];
      deferred: GutenbergDeferredFile;
    };

function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!onToggle}
      className="flex w-full items-center justify-between border-b border-border py-2 text-left"
    >
      <span className="font-mono text-sm font-medium uppercase tracking-wider text-text-primary">
        {title} <span className="text-text-muted">({count})</span>
      </span>
      {onToggle ? (
        <span className="text-xs text-text-muted">{expanded ? "▼" : "▶"}</span>
      ) : null}
    </button>
  );
}

function BookRow({
  entry,
  checked,
  onChange,
  readOnly,
  onClearManualUpload,
  clearingManual,
}: {
  entry: QueueEntry;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  readOnly?: boolean;
  onClearManualUpload?: () => void;
  clearingManual?: boolean;
}) {
  const tags = [...entry.subjects, ...entry.bookshelves].slice(0, 3);
  const extra = entry.subjects.length + entry.bookshelves.length - tags.length;

  return (
    <label
      className={`flex items-start gap-3 border-b border-border/60 py-2 text-sm ${
        readOnly ? "cursor-default" : "cursor-pointer"
      }`}
    >
      {!readOnly ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="mt-1 accent-[var(--accent)]"
        />
      ) : (
        <span className="mt-1 w-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="font-medium text-text-primary">{entry.title}</span>
        <span className="text-text-secondary"> — {entry.authorDisplay}</span>
        <span className="ml-2 text-xs text-text-muted">
          {entry.downloadCount.toLocaleString()} downloads
        </span>
        {entry.reviewReasons.length > 0 ? (
          <span className="ml-2 inline-flex flex-wrap gap-1">
            {entry.reviewReasons.map((r) => (
              <span
                key={r}
                className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] uppercase text-[#C49A3C]"
              >
                {r}
              </span>
            ))}
          </span>
        ) : null}
        {entry.rejectReason ? (
          <span className="ml-2 text-xs text-text-muted">Rejected: {entry.rejectReason}</span>
        ) : null}
        {entry.manualUploadRequired || entry.skipAutoIngest ? (
          <span className="ml-2 inline-flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#8B4513]/20 px-1.5 py-0.5 text-[10px] uppercase text-[#E8A87C]">
              Manual EPUB
              {entry.epubSizeBytes ? ` · ${formatEpubSize(entry.epubSizeBytes)}` : ""}
            </span>
            {entry.ingestSkipReason ? (
              <span className="text-[10px] text-text-muted">
                {ingestSkipReasonLabel(entry.ingestSkipReason)}
              </span>
            ) : null}
            {onClearManualUpload ? (
              <button
                type="button"
                disabled={clearingManual}
                onClick={(e) => {
                  e.preventDefault();
                  onClearManualUpload();
                }}
                className="text-[10px] underline text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {clearingManual ? "Clearing…" : "Clear flag (after manual ingest)"}
              </button>
            ) : null}
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-text-muted">
          {tags.join(" · ")}
          {extra > 0 ? ` · +${extra} more` : ""}
        </span>
      </span>
    </label>
  );
}

export function GutenbergImportClient() {
  const searchParams = useSearchParams();
  const activeTab = parseGutenbergTab(searchParams.get("tab"));
  const [state, setState] = useState<QueueState>({ status: "loading" });
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<number | null>(null);
  const [deferredFilter, setDeferredFilter] = useState<"all" | DeferReason>("all");
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const loadQueue = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/admin/gutenberg-queue");
      const data = (await res.json()) as GutenbergQueueFile & { exists?: false; error?: string };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if ("exists" in data && data.exists === false) {
        setState({ status: "empty" });
        return;
      }
      const queue = data as GutenbergQueueFile & { deferred?: GutenbergDeferredFile };
      const entries = queue.entries ?? [];
      const deferred = queue.deferred ?? { updatedAt: "", entries: [] };
      const initialChecked: Record<number, boolean> = {};
      for (const e of entries) {
        if (e.filterResult === "accepted") {
          initialChecked[e.gutenbergId] = e.approved !== false;
        } else if (e.filterResult === "review") {
          initialChecked[e.gutenbergId] = e.approved === true;
        }
      }
      setChecked(initialChecked);
      setState({ status: "ready", queue, entries, deferred });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load queue",
      });
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const byFilter = useMemo(() => {
    if (state.status !== "ready") {
      return {
        accepted: [] as QueueEntry[],
        review: [] as QueueEntry[],
        rejected: [] as QueueEntry[],
        manualUpload: [] as QueueEntry[],
      };
    }
    const accepted: QueueEntry[] = [];
    const review: QueueEntry[] = [];
    const rejected: QueueEntry[] = [];
    const manualUpload: QueueEntry[] = [];
    for (const e of state.entries) {
      if (e.manualUploadRequired || e.skipAutoIngest) {
        manualUpload.push(e);
      }
      if (e.filterResult === "accepted") accepted.push(e);
      else if (e.filterResult === "review") review.push(e);
      else rejected.push(e);
    }
    return { accepted, review, rejected, manualUpload };
  }, [state]);

  const filteredDeferred = useMemo(() => {
    if (state.status !== "ready") return [] as DeferredQueueEntry[];
    if (deferredFilter === "all") return state.deferred.entries;
    return state.deferred.entries.filter((e) => e.deferReason === deferredFilter);
  }, [state, deferredFilter]);

  async function restoreDeferred(gutenbergId: number) {
    setRestoringId(gutenbergId);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/gutenberg-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreDeferred: [gutenbergId] }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      await loadQueue();
      setSaveMessage(`Restored gutenbergId ${gutenbergId} to the discovery queue (not approved).`);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  async function clearManualUploadFlag(gutenbergId: number) {
    setClearingId(gutenbergId);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/gutenberg-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ gutenbergId, clearManualUpload: true }] }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      await loadQueue();
      setSaveMessage(`Cleared manual-upload flag for gutenbergId ${gutenbergId}.`);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Clear flag failed");
    } finally {
      setClearingId(null);
    }
  }

  const queuedCount = useMemo(() => {
    if (state.status !== "ready") return 0;
    return state.entries.filter(
      (e) =>
        (e.filterResult === "accepted" || e.filterResult === "review") &&
        checked[e.gutenbergId] === true &&
        !e.skipAutoIngest,
    ).length;
  }, [state, checked]);

  async function saveApprovals() {
    if (state.status !== "ready") return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const updates = state.entries
        .filter((e) => e.filterResult === "accepted" || e.filterResult === "review")
        .map((e) => ({
          gutenbergId: e.gutenbergId,
          approved: checked[e.gutenbergId] === true,
        }));

      const res = await fetch("/api/admin/gutenberg-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = (await res.json()) as { error?: string; approvedCount?: number };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSaveMessage(
        `Saved ${data.approvedCount ?? queuedCount} approved book(s). Run: npx tsx scripts/gutenberg-ingest.ts`,
      );
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const publishLink = {
    href: "/admin/books",
    label: "Publish",
    icon: "◎",
    hint: "Pending review → Discover",
  } as const;

  const tabCounts = useMemo(() => {
    if (state.status !== "ready") return undefined;
    return {
      overview: state.entries.length,
      accepted: byFilter.accepted.length,
      review: byFilter.review.length,
      rejected: byFilter.rejected.length,
      deferred: state.deferred.entries.length,
      manual: byFilter.manualUpload.length,
    } satisfies Partial<Record<GutenbergImportTab, number>>;
  }, [state, byFilter]);

  const showApprovalFooter = activeTab === "accepted" || activeTab === "review";
  const nav = <GutenbergSectionNav counts={tabCounts} externalLinks={[publishLink]} />;

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        {nav}
        <p className="text-sm text-text-secondary">Loading queue…</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="space-y-4">
        {nav}
        <p className="rounded-lg border border-border bg-bg-surface p-4 text-sm text-text-secondary">
          No queue file found. Run the discovery script first:{" "}
          <code className="text-text-primary">npx tsx scripts/gutenberg-fetch.ts</code>
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        {nav}
        <p className="text-sm text-error">{state.message}</p>
      </div>
    );
  }

  const { queue } = state;

  return (
    <div className="space-y-6 pb-24">
      {nav}

      {activeTab === "overview" ? (
        <div className="rounded-lg border border-border bg-bg-surface p-4 text-sm space-y-2">
          <p className="text-text-secondary">
            Fetched: <span className="text-text-primary">{new Date(queue.fetchedAt).toLocaleString()}</span>
            {" · "}
            Mode: <span className="text-text-primary">{queue.mode}</span>
          </p>
          <p className="text-text-secondary">
            {queue.totalAccepted} accepted · {queue.totalReview} under review · {queue.totalRejected}{" "}
            rejected
            {queue.totalSkippedDelta > 0 ? ` · ${queue.totalSkippedDelta} skipped (delta)` : ""}
            {state.deferred.entries.length > 0 ? ` · ${state.deferred.entries.length} deferred` : ""}
          </p>
          <p className="text-[#C49A3C] border-t border-border/60 pt-2 mt-2">
            Ingested books are created as <strong>pending_review</strong>. They must be published via{" "}
            <Link href="/admin/books" className="underline text-text-primary">
              Books admin
            </Link>{" "}
            before they appear on Discover (requires a cover image).
          </p>
          <p className="text-xs text-text-muted">
            Use the tabs above to review each list. After approving, run{" "}
            <code className="text-text-primary">npm run gutenberg-ingest -- --resume</code>.
          </p>
        </div>
      ) : null}

      {activeTab === "deferred" ? (
        <section className="rounded-lg border border-[#8B4513]/40 bg-[#8B4513]/10 p-4">
          <SectionHeader title="Deferred (manual / blocked)" count={state.deferred.entries.length} expanded />
          <p className="mt-2 text-xs text-text-secondary">
            Parked titles live in <code className="text-text-primary">scripts/gutenberg-queue-deferred.json</code>.
            They are removed from the active ingest queue. Upload EPUBs manually via{" "}
            <Link href="/admin/books" className="underline text-text-primary">
              Books admin
            </Link>
            , or restore below.
          </p>
          {state.deferred.entries.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No deferred titles.</p>
          ) : (
            <>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                [INGEST_DEFER_NO_EPUB, "No EPUB"],
                [INGEST_SKIP_EPUB_TOO_LARGE, "Too large"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDeferredFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  deferredFilter === key
                    ? "bg-[var(--accent)] text-text-primary"
                    : "bg-bg-raised text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-1">
            {filteredDeferred.map((e) => (
              <div
                key={`deferred-${e.gutenbergId}`}
                className="flex items-start gap-3 border-b border-border/60 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <BookRow entry={e} checked={false} readOnly />
                  <span className="ml-7 block text-[10px] text-text-muted">
                    Parked {new Date(e.deferredAt).toLocaleString()} · {deferReasonLabel(e.deferReason)}
                    {e.epubUrl ? (
                      <>
                        {" "}
                        · <span className="font-mono break-all">{e.epubUrl}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={restoringId === e.gutenbergId}
                  onClick={() => void restoreDeferred(e.gutenbergId)}
                  className="shrink-0 text-xs underline text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  {restoringId === e.gutenbergId ? "Restoring…" : "Restore to queue"}
                </button>
              </div>
            ))}
          </div>
            </>
          )}
        </section>
      ) : null}

      {activeTab === "manual" ? (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <SectionHeader title="Still flagged (not parked yet)" count={byFilter.manualUpload.length} expanded />
          <p className="mt-2 text-xs text-text-secondary">
            Run <code className="text-text-primary">npm run gutenberg-park-deferred</code> to move these into the
            deferred file and clean the ingest list.
          </p>
          {byFilter.manualUpload.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No flagged titles on the active queue.</p>
          ) : (
            <div className="mt-1">
              {byFilter.manualUpload.map((e) => (
                <BookRow
                  key={`manual-${e.gutenbergId}`}
                  entry={e}
                  checked={false}
                  readOnly
                  onClearManualUpload={() => void clearManualUploadFlag(e.gutenbergId)}
                  clearingManual={clearingId === e.gutenbergId}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "accepted" ? (
        <section>
          <SectionHeader title="Accepted" count={byFilter.accepted.length} expanded />
          {byFilter.accepted.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No accepted titles in the queue.</p>
          ) : (
            <div className="mt-1">
              {byFilter.accepted.map((e) => (
                <BookRow
                  key={e.gutenbergId}
                  entry={e}
                  checked={checked[e.gutenbergId] ?? true}
                  onChange={(v) => setChecked((c) => ({ ...c, [e.gutenbergId]: v }))}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "review" ? (
        <section>
          <SectionHeader title="Needs review" count={byFilter.review.length} expanded />
          {byFilter.review.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No titles need review.</p>
          ) : (
            <div className="mt-1">
              {byFilter.review.map((e) => (
                <BookRow
                  key={e.gutenbergId}
                  entry={e}
                  checked={checked[e.gutenbergId] ?? false}
                  onChange={(v) => setChecked((c) => ({ ...c, [e.gutenbergId]: v }))}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "rejected" ? (
        <section>
          <SectionHeader title="Rejected" count={byFilter.rejected.length} expanded />
          {byFilter.rejected.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No rejected titles.</p>
          ) : (
            <div className="mt-1">
              {byFilter.rejected.map((e) => (
                <BookRow key={e.gutenbergId} entry={e} checked={false} readOnly />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showApprovalFooter ? (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-base/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{queuedCount}</span> books queued for
            ingestion
          </p>
          <button
            type="button"
            disabled={queuedCount === 0 || saving}
            onClick={() => void saveApprovals()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Queue approved books"}
          </button>
        </div>
      </div>
      ) : null}

      {saveMessage ? (
        <p className="text-sm text-text-secondary rounded-lg border border-border p-3">{saveMessage}</p>
      ) : null}
    </div>
  );
}
