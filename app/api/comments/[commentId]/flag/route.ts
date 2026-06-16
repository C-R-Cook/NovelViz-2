import { getCurrentUser } from "@/lib/auth";
import {
  AdminEmailCategory,
  absoluteAppUrl,
  sendAdminEmail,
} from "@/lib/admin-email";
import {
  isCommentSpoilerScanDebugEnabled,
  parseCommentSpoilerScanDebug,
} from "@/lib/comment-spoiler-scan-debug";
import { getCommentViewerPresentation } from "@/lib/comment-visibility";
import { createNotification, notifyUsersWithRole } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { CommentStatus, NotificationType, UserRole, type SpoilerProtection } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ commentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await context.params;

  const exposeDebug = isCommentSpoilerScanDebugEnabled();
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      content: true,
      status: true,
      spoilerGateChapter: true,
      spoilerModerationAt: true,
      spoilerScanDebug: true,
      user: { select: { username: true } },
      image: {
        select: {
          id: true,
          bookId: true,
          userId: true,
          chapterNumberAtTime: true,
          book: { select: { title: true } },
        },
      },
    },
  });

  if (!comment || comment.status === CommentStatus.DELETED) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.userId === dbUser.id) {
    return NextResponse.json({ error: "You cannot flag your own comment" }, { status: 400 });
  }

  if (
    comment.status !== CommentStatus.VISIBLE &&
    comment.status !== CommentStatus.HIDDEN_SPOILER
  ) {
    return NextResponse.json(
      { error: "This comment cannot be reported for review" },
      { status: 400 },
    );
  }

  const viewer = { id: dbUser.id, role: dbUser.role };
  const isAdmin = dbUser.role === UserRole.admin;
  let userBookSpoiler: SpoilerProtection | null | undefined;
  const globalSpoilerProtection = dbUser.globalSpoilerProtection;
  let currentChapterNumber: number | undefined;

  if (!isAdmin) {
    const [userBook, progress] = await Promise.all([
      prisma.userBook.findFirst({
        where: { userId: dbUser.id, bookId: comment.image.bookId, isActive: true },
        select: { spoilerProtection: true },
      }),
      prisma.readingProgress.findUnique({
        where: { userId_bookId: { userId: dbUser.id, bookId: comment.image.bookId } },
        select: { currentChapterNumber: true },
      }),
    ]);
    userBookSpoiler = userBook?.spoilerProtection;
    currentChapterNumber = progress?.currentChapterNumber;
  }

  const scanDebug = exposeDebug ? parseCommentSpoilerScanDebug(comment.spoilerScanDebug) : null;

  const presentation = getCommentViewerPresentation({
    viewer,
    sessionOverride: false,
    comment: {
      status: comment.status,
      userId: comment.userId,
      spoilerGateChapter: comment.spoilerGateChapter,
      spoilerModerationAt: comment.spoilerModerationAt,
    },
    imageChapterNumber: comment.image.chapterNumberAtTime,
    imageOwnerUserId: comment.image.userId,
    userBookSpoiler,
    globalSpoilerProtection,
    currentChapterNumber,
    spoilerScanDebug: scanDebug,
  });

  const canReport =
    comment.userId !== dbUser.id &&
    presentation.revealContent &&
    (comment.status === CommentStatus.VISIBLE ||
      comment.status === CommentStatus.HIDDEN_SPOILER);

  if (!canReport) {
    return NextResponse.json(
      { error: "You can only report comments you can read in full" },
      { status: 400 },
    );
  }

  const bookId = comment.image.bookId;
  const imageId = comment.image.id;
  const link = `/gallery/${bookId}?image=${encodeURIComponent(imageId)}`;
  const bookTitle = comment.image.book.title;

  await prisma.comment.update({
    where: { id: commentId },
    data: { status: CommentStatus.PENDING_CONTENT_REVIEW },
  });

  await createNotification(
    comment.userId,
    NotificationType.COMMENT_REPORTED_TO_AUTHOR,
    `Your comment on "${bookTitle}" was reported for review by another reader.`,
    link,
  );

  notifyUsersWithRole(
    UserRole.admin,
    NotificationType.COMMENT_FLAGGED_FOR_MODERATION,
    `A comment on "${bookTitle}" was reported for inappropriate content.`,
    link,
  );

  const chapter = comment.image.chapterNumberAtTime;
  sendAdminEmail({
    category: AdminEmailCategory.COMMENT_FLAG,
    subjectDetail: `"${bookTitle}" - Ch. ${chapter}`,
    bodyLines: [
      { label: "Book", value: bookTitle },
      { label: "Chapter", value: String(chapter) },
      { label: "Comment author", value: comment.user.username ?? comment.userId },
      { label: "Comment", value: comment.content },
      {
        label: "Reported by",
        value: `${sessionUser.username ?? sessionUser.id} (${sessionUser.email ?? "no email"})`,
      },
      { label: "Public Gallery", value: absoluteAppUrl(link) },
      { label: "Moderation queue", value: absoluteAppUrl("/dashboard?tab=flagged-comments") },
    ],
  });

  return NextResponse.json({ ok: true });
}
