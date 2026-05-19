import { parseCommentSpoilerScanDebug } from "@/lib/comment-spoiler-scan-debug";
import type { AdminSpoilerCommentRow } from "@/lib/admin-spoiler-comments-queue";
import { prisma } from "@/lib/prisma";
import { CommentStatus } from "@db";

export type AdminFlaggedCommentRow = AdminSpoilerCommentRow;

const pendingWhere = {
  status: CommentStatus.PENDING_CONTENT_REVIEW,
} as const;

export async function countPendingFlaggedComments(): Promise<number> {
  return prisma.comment.count({ where: pendingWhere });
}

export async function queryAdminFlaggedCommentsQueue(take = 80): Promise<AdminFlaggedCommentRow[]> {
  const rows = await prisma.comment.findMany({
    where: pendingWhere,
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      content: true,
      createdAt: true,
      spoilerScanDebug: true,
      spoilerGateChapter: true,
      user: { select: { username: true, name: true } },
      image: {
        select: {
          id: true,
          imageUrl: true,
          isFeatured: true,
          userPrompt: true,
          chapterNumberAtTime: true,
          book: {
            select: { id: true, title: true, author: true, coverImageUrl: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAtMs: row.createdAt.getTime(),
    username: row.user.username ?? row.user.name ?? "Reader",
    imageId: row.image.id,
    imageUrl: row.image.imageUrl,
    imageIsFeatured: row.image.isFeatured,
    userPrompt: row.image.userPrompt,
    chapterNumberAtTime: row.image.chapterNumberAtTime,
    bookId: row.image.book.id,
    bookTitle: row.image.book.title,
    bookAuthor: row.image.book.author,
    bookCoverImageUrl: row.image.book.coverImageUrl,
    spoilerScanDebug: parseCommentSpoilerScanDebug(row.spoilerScanDebug),
    spoilerGateChapter: row.spoilerGateChapter,
  }));
}
