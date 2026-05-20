import fs from "node:fs";
import path from "node:path";
import type { DeferReason, GutenbergQueueFile, QueueEntry } from "./gutenberg-types";

export const DEFERRED_QUEUE_PATH = "scripts/gutenberg-queue-deferred.json";

export type DeferredQueueEntry = QueueEntry & {
  deferredAt: string;
  deferReason: DeferReason;
};

export interface GutenbergDeferredFile {
  updatedAt: string;
  entries: DeferredQueueEntry[];
}

export function emptyDeferredFile(): GutenbergDeferredFile {
  return { updatedAt: new Date().toISOString(), entries: [] };
}

export function resolveDeferredQueuePath(cwd = process.cwd()): string {
  return path.resolve(cwd, DEFERRED_QUEUE_PATH);
}

export function readDeferredFile(cwd = process.cwd()): GutenbergDeferredFile {
  const filePath = resolveDeferredQueuePath(cwd);
  if (!fs.existsSync(filePath)) {
    return emptyDeferredFile();
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as GutenbergDeferredFile;
  return {
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
}

export function writeDeferredFile(deferred: GutenbergDeferredFile, cwd = process.cwd()): void {
  const filePath = resolveDeferredQueuePath(cwd);
  deferred.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(deferred, null, 2), "utf8");
}

export function writeQueueAndDeferred(
  queue: GutenbergQueueFile,
  deferred: GutenbergDeferredFile,
  cwd = process.cwd(),
): void {
  const queuePath = path.resolve(cwd, "scripts/gutenberg-queue.json");
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
  writeDeferredFile(deferred, cwd);
}

/** Move a queue row into the deferred file (removed from the active discovery queue). */
export function parkQueueEntry(
  queue: GutenbergQueueFile,
  deferred: GutenbergDeferredFile,
  gutenbergId: number,
  reason: DeferReason,
): boolean {
  const index = queue.entries.findIndex((e) => e.gutenbergId === gutenbergId);
  if (index === -1) return false;

  const [entry] = queue.entries.splice(index, 1);
  if (!entry) return false;

  const deferredEntry: DeferredQueueEntry = {
    ...entry,
    approved: false,
    deferredAt: new Date().toISOString(),
    deferReason: reason,
  };

  const existing = deferred.entries.findIndex((e) => e.gutenbergId === gutenbergId);
  if (existing >= 0) {
    deferred.entries[existing] = deferredEntry;
  } else {
    deferred.entries.push(deferredEntry);
  }

  return true;
}

/** Return a parked title to the discovery queue (not auto-approved). */
export function restoreDeferredEntry(
  queue: GutenbergQueueFile,
  deferred: GutenbergDeferredFile,
  gutenbergId: number,
): boolean {
  const index = deferred.entries.findIndex((e) => e.gutenbergId === gutenbergId);
  if (index === -1) return false;

  const [entry] = deferred.entries.splice(index, 1);
  if (!entry) return false;

  const { deferredAt: _removedAt, deferReason: _removedReason, ...rest } = entry;
  const restored: QueueEntry = {
    ...rest,
    approved: null,
    skipAutoIngest: false,
    manualUploadRequired: false,
    ingestSkipReason: null,
    epubSizeBytes: null,
  };
  void _removedAt;
  void _removedReason;

  if (!queue.entries.some((e) => e.gutenbergId === gutenbergId)) {
    queue.entries.push(restored);
  }

  return true;
}
