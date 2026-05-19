import { parseCommentSpoilerScanDebug, type CommentSpoilerScanDebug } from "@/lib/comment-spoiler-scan-debug";
import { prisma } from "@/lib/prisma";
import { CommentStatus } from "@db";

export type AdminSpoilerCommentRow = {
  id: string;
  content: string;
  createdAtMs: number;
  username: string;
  imageId: string;
  imageUrl: string;
  imageIsFeatured: boolean;
  userPrompt: string | null;
  chapterNumberAtTime: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverImageUrl: string | null;
  spoilerScanDebug: CommentSpoilerScanDebug | null;
  spoilerGateChapter: number | null;
};

const pendingHiddenWhere = {
  status: CommentStatus.HIDDEN_SPOILER,
  spoilerModerationAt: null,
} as const;

export async function countPendingSpoilerComments(): Promise<number> {
  return prisma.comment.count({ where: pendingHiddenWhere });
}

export async function queryAdminSpoilerCommentsQueue(take = 80): Promise<AdminSpoilerCommentRow[]> {
  const rows = await prisma.comment.findMany({
    where: pendingHiddenWhere,
    orderBy: { createdAt: "desc" },
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
