import { BookStatus, UserRole } from "@db";

export function isCoverAiQuotaExemptEligible(book: {
  isPublicDomain: boolean;
  status: BookStatus;
}): boolean {
  return (
    book.isPublicDomain ||
    book.status === BookStatus.pending_review ||
    book.status === BookStatus.processing
  );
}

/** Admins never consume a book's partner cover-generation allowance. */
export function resolveCoverAiQuotaExempt(params: { role: UserRole }): boolean {
  return params.role === UserRole.admin;
}

export function canAccessBookCoverAi(
  role: UserRole,
  dbUserId: string,
  book: { ownerId: string | null },
): boolean {
  if (role === UserRole.admin) return true;
  return book.ownerId !== null && book.ownerId === dbUserId;
}

const DRAFT_PREFIX = "novelviz/cover-drafts/";

export function isCoverAiDraftPublicIdForBook(bookId: string, publicId: string): boolean {
  const expected = `${DRAFT_PREFIX}${bookId}/`;
  return publicId.startsWith(expected) && publicId.length > expected.length + 8;
}

export function buildCoverDraftPrefix(bookId: string): string {
  return `${DRAFT_PREFIX}${bookId}/`;
}
