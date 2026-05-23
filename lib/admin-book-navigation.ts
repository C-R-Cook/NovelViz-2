/** Default admin queue after approving or publishing a book. */
export const DEFAULT_ADMIN_BOOK_RETURN = "/dashboard?tab=for-review";

/** Only allow same-origin relative paths (no open redirects). */
export function safeAdminReturnTo(raw: string | null | undefined): string {
  if (!raw?.trim()) return DEFAULT_ADMIN_BOOK_RETURN;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return DEFAULT_ADMIN_BOOK_RETURN;
  }
  if (!path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_ADMIN_BOOK_RETURN;
  }
  return path;
}

export function adminBookDetailHref(bookId: string, returnTo?: string): string {
  const safe = safeAdminReturnTo(returnTo);
  return `/admin/books/${bookId}?returnTo=${encodeURIComponent(safe)}`;
}
