import type { BookStatus, ListingPreferenceAfterReview } from "@db";

/** Admin books table page size — standalone `/admin/books` — must match GET handler default cap when `take` omitted. */
export const ADMIN_BOOKS_PAGE_SIZE = 50;

/** For-review dashboard queue page size (must match `loadAdminDashboardData` initial take). */
export const FOR_REVIEW_QUEUE_PAGE_SIZE = ADMIN_BOOKS_PAGE_SIZE;

/** Dashboard “All Books” tab — newest-first default, max rows per fetch. */
export const DASHBOARD_ADMIN_BOOKS_LIMIT = 20;

/** Hard cap per request (`take` query param clamped server-side). */
export const ADMIN_BOOKS_TAKE_MAX = 50;

/** Max length for admin book search query (`q` param). */
export const ADMIN_BOOKS_SEARCH_MAX_LEN = 100;

export type AdminBooksFilterKey = "all" | "deleted" | BookStatus;

export type AdminBooksSortField =
  | "createdAt"
  | "updatedAt"
  | "title"
  | "author"
  | "owner"
  | "status"
  | "chapters";

export type AdminBooksSortDirection = "asc" | "desc";

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: BookStatus;
  isDeleted: boolean;
  ownerLabel: string | null;
  /** Pre-formatted server-side */
  createdAtLabel: string;
  chapterCount: number;
  listingPreferenceAfterReview: ListingPreferenceAfterReview | null;
};

const FILTER_VALUES: readonly AdminBooksFilterKey[] = [
  "all",
  "deleted",
  "draft",
  "pending_review",
  "rejected",
  "processing",
  "published",
  "unlisted",
];

const SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "title",
  "author",
  "owner",
  "status",
  "chapters",
] as const satisfies readonly AdminBooksSortField[];

export function parseAdminBooksFilterParam(value: string | null): AdminBooksFilterKey {
  if (!value) return "pending_review";
  if ((FILTER_VALUES as readonly string[]).includes(value)) {
    return value as AdminBooksFilterKey;
  }
  return "pending_review";
}

export function parseAdminBooksTakeParam(value: string | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(ADMIN_BOOKS_TAKE_MAX, Math.floor(n));
}

export function parseAdminBooksSortField(value: string | null): AdminBooksSortField {
  if (value && (SORT_FIELDS as readonly string[]).includes(value)) {
    return value as AdminBooksSortField;
  }
  return "createdAt";
}

export function parseAdminBooksSortDirection(value: string | null): AdminBooksSortDirection {
  return value === "asc" ? "asc" : "desc";
}

export function parseAdminBooksSearchParam(value: string | null): string | undefined {
  if (value === null || value === "") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, ADMIN_BOOKS_SEARCH_MAX_LEN);
}

export type QueryAdminBooksPageArgs = {
  filter: AdminBooksFilterKey;
  skip: number;
  /** Omit = {@link ADMIN_BOOKS_PAGE_SIZE}. */
  take?: number;
  sort?: AdminBooksSortField;
  dir?: AdminBooksSortDirection;
  /** Case-insensitive match on title or author. */
  q?: string;
};
