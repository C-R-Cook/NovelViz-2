export type FilterResult = "accepted" | "review" | "rejected";

/** Why auto-ingest was skipped (e.g. EPUB over size cap). */
export const INGEST_SKIP_EPUB_TOO_LARGE = "epub_too_large" as const;
export type IngestSkipReason = typeof INGEST_SKIP_EPUB_TOO_LARGE;

export function shouldSkipAutoIngest(entry: QueueEntry): boolean {
  return entry.skipAutoIngest === true;
}

export function defaultQueueIngestFlags(): Pick<
  QueueEntry,
  "skipAutoIngest" | "manualUploadRequired" | "ingestSkipReason" | "epubSizeBytes"
> {
  return {
    skipAutoIngest: false,
    manualUploadRequired: false,
    ingestSkipReason: null,
    epubSizeBytes: null,
  };
}

export interface QueueEntry {
  gutenbergId: number;
  title: string;
  authorDisplay: string;
  authorRaw: string;
  subjects: string[];
  bookshelves: string[];
  gutendexCoverUrl: string | null;
  epubUrl: string | null;
  downloadCount: number;
  filterResult: FilterResult;
  rejectReason: string | null;
  reviewReasons: string[];
  approved: boolean | null;
  ingestedAt: string | null;
  /** When true, ingest CLI skips this title (resume/limit). */
  skipAutoIngest: boolean;
  /** Shown in admin UI — upload EPUB via partner/admin ingest, then clear the flag. */
  manualUploadRequired: boolean;
  ingestSkipReason: IngestSkipReason | null;
  epubSizeBytes: number | null;
}

export interface GutenbergQueueFile {
  fetchedAt: string;
  mode: "full" | "delta";
  totalFetched: number;
  totalAccepted: number;
  totalReview: number;
  totalRejected: number;
  totalSkippedDelta: number;
  entries: QueueEntry[];
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  subjects: string[];
  bookshelves: string[];
  formats: Record<string, string>;
  download_count: number;
}

export interface GutendexResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
}
