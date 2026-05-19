export type FilterResult = "accepted" | "review" | "rejected";

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
