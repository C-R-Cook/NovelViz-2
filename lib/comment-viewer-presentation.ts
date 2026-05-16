import type { CommentSpoilerScanDebug } from "@/lib/comment-spoiler-scan-debug";
import { isBehindSpoilerCommentGate } from "@/lib/gallery-spoiler";
import { CommentStatus, UserRole, type SpoilerProtection } from "@db";

export type CommentVisibilityViewer = {
  id: string;
  role: UserRole;
};

export type CommentPresentationInput = {
  viewer: CommentVisibilityViewer | null;
  sessionOverride: boolean;
  comment: {
    status: CommentStatus;
    userId: string;
    spoilerGateChapter: number | null;
    spoilerModerationAt: Date | null;
  };
  imageChapterNumber: number;
  imageOwnerUserId: string;
  userBookSpoiler: SpoilerProtection | null | undefined;
  globalSpoilerProtection: boolean;
  currentChapterNumber: number | undefined;
  spoilerScanDebug?: CommentSpoilerScanDebug | null;
};

export type CommentViewerPresentation = {
  /** Show a row in the comment list (includes blurred placeholders). */
  listVisible: boolean;
  /** Send plaintext to the client. */
  revealContent: boolean;
  spoilerLocked: boolean;
  spoilerGateChapter: number | null;
  chapterGap: number | null;
  lockMessage: string | null;
  isOwnComment: boolean;
  showAuthorReview: boolean;
  /** Pending moderation; reader is past the gate and may read at their own risk. */
  showPendingSpoilerNotice: boolean;
  noticeImageChapter: number | null;
  /** Comment reported as inappropriate; author sees notice. */
  showContentReviewNotice?: boolean;
  /** Author only: moderator confirmed spoiler gating (no longer “pending review”). */
  showAuthorSpoilerConfirmedNotice?: boolean;
};

export function resolveSpoilerGateChapter(
  imageChapter: number,
  storedGate: number | null | undefined,
  spoilerScanDebug?: CommentSpoilerScanDebug | null,
): number {
  if (typeof storedGate === "number" && storedGate > 0) return storedGate;
  const fromDebug = spoilerScanDebug?.spoilerChapter;
  if (typeof fromDebug === "number" && fromDebug > 0) return fromDebug;
  return imageChapter;
}

function spoilerChapterGap(
  behindGate: boolean,
  gateChapter: number,
  currentChapter: number | undefined,
): number | null {
  if (!behindGate) return null;
  if (currentChapter !== undefined) {
    return Math.max(1, gateChapter - currentChapter);
  }
  return gateChapter;
}

export function getCommentViewerPresentation(input: CommentPresentationInput): CommentViewerPresentation {
  const { comment, viewer } = input;
  const isOwnComment = viewer !== null && comment.userId === viewer.id;
  const isImageOwner = viewer !== null && viewer.id === input.imageOwnerUserId;
  const gateChapter = resolveSpoilerGateChapter(
    input.imageChapterNumber,
    comment.spoilerGateChapter,
    input.spoilerScanDebug,
  );

  const base: CommentViewerPresentation = {
    listVisible: false,
    revealContent: false,
    spoilerLocked: false,
    spoilerGateChapter: null,
    chapterGap: null,
    lockMessage: null,
    isOwnComment,
    showAuthorReview: false,
    showPendingSpoilerNotice: false,
    noticeImageChapter: null,
  };

  if (comment.status === CommentStatus.DELETED) {
    return base;
  }

  if (comment.status === CommentStatus.VISIBLE) {
    return {
      ...base,
      listVisible: true,
      revealContent: true,
    };
  }

  if (comment.status === CommentStatus.PENDING_CONTENT_REVIEW) {
    if (viewer?.role === UserRole.admin || input.sessionOverride) {
      return {
        ...base,
        listVisible: true,
        revealContent: true,
      };
    }
    if (isOwnComment) {
      return {
        ...base,
        listVisible: true,
        revealContent: true,
        showContentReviewNotice: true,
      };
    }
    return base;
  }

  if (comment.status !== CommentStatus.HIDDEN_SPOILER) {
    return base;
  }

  const adminConfirmed = comment.spoilerModerationAt != null;
  const behindSpoilerGate = isBehindSpoilerCommentGate(input.currentChapterNumber, gateChapter);
  const chapterGap = spoilerChapterGap(behindSpoilerGate, gateChapter, input.currentChapterNumber);

  if (viewer?.role === UserRole.admin || input.sessionOverride) {
    return {
      ...base,
      listVisible: true,
      revealContent: true,
      spoilerGateChapter: gateChapter,
    };
  }

  if (isOwnComment) {
    return {
      ...base,
      listVisible: true,
      revealContent: true,
      spoilerGateChapter: gateChapter,
      showAuthorReview: !adminConfirmed,
      ...(adminConfirmed ? { showAuthorSpoilerConfirmedNotice: true } : {}),
    };
  }

  if (!adminConfirmed) {
    if (behindSpoilerGate) {
      return {
        ...base,
        listVisible: true,
        revealContent: false,
        spoilerLocked: true,
        spoilerGateChapter: gateChapter,
        chapterGap,
        lockMessage: `Spoiler locked — read through chapter ${gateChapter} to view`,
      };
    }

    if (!isImageOwner) {
      return {
        ...base,
        listVisible: true,
        revealContent: true,
        spoilerGateChapter: gateChapter,
        showPendingSpoilerNotice: true,
        noticeImageChapter: input.imageChapterNumber,
      };
    }

    return {
      ...base,
      listVisible: true,
      revealContent: false,
      spoilerLocked: true,
      spoilerGateChapter: gateChapter,
      lockMessage: "Spoiler under review",
    };
  }

  if (behindSpoilerGate) {
    return {
      ...base,
      listVisible: true,
      revealContent: false,
      spoilerLocked: true,
      spoilerGateChapter: gateChapter,
      chapterGap,
      lockMessage: `Spoiler — read through chapter ${gateChapter} to view`,
    };
  }

  return {
    ...base,
    listVisible: true,
    revealContent: true,
    spoilerGateChapter: gateChapter,
  };
}

/** @deprecated Use getCommentViewerPresentation — kept for callers migrating gradually. */
export function shouldIncludeCommentForViewer(
  input: Omit<CommentPresentationInput, "comment"> & {
    comment: {
      status: CommentStatus;
      userId: string;
      spoilerGateChapter?: number | null;
      spoilerModerationAt?: Date | null;
    };
  },
): boolean {
  return getCommentViewerPresentation({
    ...input,
    comment: {
      userId: input.comment.userId,
      status: input.comment.status,
      spoilerGateChapter: input.comment.spoilerGateChapter ?? null,
      spoilerModerationAt: input.comment.spoilerModerationAt ?? null,
    },
  }).listVisible;
}
