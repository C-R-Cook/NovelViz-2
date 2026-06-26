import {
  cloudinaryCoverDraftsFolder,
  LEGACY_CLOUDINARY_DRAFT_PREFIX,
} from "@/lib/cloudinary";
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
  return params.role === "admin";
}

export function canAccessBookCoverAi(
  role: UserRole,
  dbUserId: string,
  book: { ownerId: string | null },
): boolean {
  if (role === UserRole.admin) return true;
  return book.ownerId !== null && book.ownerId === dbUserId;
}

export function buildCoverDraftPrefix(bookId: string): string {
  return `${cloudinaryCoverDraftsFolder(bookId)}/`;
}

/** All draft folder prefixes that may appear for a book (legacy + both envs). */
export function coverAiDraftPrefixesForBook(bookId: string): string[] {
  return [
    `${LEGACY_CLOUDINARY_DRAFT_PREFIX}${bookId}/`,
    `novelviz/dev/cover-drafts/${bookId}/`,
    `novelviz/prod/cover-drafts/${bookId}/`,
  ];
}

export function isCoverAiDraftPublicIdForBook(bookId: string, publicId: string): boolean {
  for (const prefix of coverAiDraftPrefixesForBook(bookId)) {
    if (publicId.startsWith(prefix) && publicId.length > prefix.length + 8) {
      return true;
    }
  }
  return false;
}
