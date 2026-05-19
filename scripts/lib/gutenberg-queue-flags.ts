import {
  INGEST_SKIP_EPUB_TOO_LARGE,
  type IngestSkipReason,
  type QueueEntry,
} from "./gutenberg-types";

export function flagQueueEntryManualUpload(
  entry: QueueEntry,
  reason: IngestSkipReason,
  epubSizeBytes?: number,
): void {
  entry.skipAutoIngest = true;
  entry.manualUploadRequired = true;
  entry.ingestSkipReason = reason;
  if (epubSizeBytes != null) entry.epubSizeBytes = epubSizeBytes;
}

export function clearQueueEntryManualUpload(entry: QueueEntry): void {
  entry.skipAutoIngest = false;
  entry.manualUploadRequired = false;
  entry.ingestSkipReason = null;
  entry.epubSizeBytes = null;
}

export function formatEpubSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "unknown size";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ingestSkipReasonLabel(reason: IngestSkipReason | null | undefined): string {
  if (reason === INGEST_SKIP_EPUB_TOO_LARGE) return "EPUB over 4.5 MB";
  return reason ?? "Manual upload required";
}
