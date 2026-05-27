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

export function resolveCoverAiQuotaExempt(params: {
  role: UserRole;
  quotaExemptRequested: boolean;
  book: { isPublicDomain: boolean; status: BookStatus };
}): boolean {
  if (params.role !== UserRole.admin || !params.quotaExemptRequested) {
    return false;
  }
  return isCoverAiQuotaExemptEligible(params.book);
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
