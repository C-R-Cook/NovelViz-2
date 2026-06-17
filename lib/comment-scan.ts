import { getAnthropicTextResponse } from "@/lib/anthropic-text";
import {
  AdminEmailCategory,
  absoluteAppUrl,
  sendAdminEmail,
} from "@/lib/admin-email";
import type { CommentSpoilerScanDebug } from "@/lib/comment-spoiler-scan-debug";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { CommentStatus, NotificationType } from "@db";
import { Prisma } from "@db";

const SCAN_SYSTEM = `You are a moderation assistant for a novel discussion site.
Given a book title, the chapter number attached to an illustration, and a user comment on that illustration, decide if the comment likely contains spoilers for readers who have NOT yet reached that chapter.

Respond with ONLY a single JSON object, no markdown, no code fences, in one of these shapes:
{"isSpoiler":false}
{"isSpoiler":true}
{"isSpoiler":true,"spoilerChapter":<number>}

Use spoilerChapter only when isSpoiler is true and the comment clearly references a later chapter number.`;

export type SpoilerScanParseResult = {
  isSpoiler: boolean;
  spoilerChapter: number | null;
};

function stripJsonFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return t.trim();
}

export function parseSpoilerDecision(text: string): SpoilerScanParseResult | null {
  const cleaned = stripJsonFences(text);
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as { isSpoiler?: unknown; spoilerChapter?: unknown };
    if (typeof o.isSpoiler !== "boolean") return null;
    let spoilerChapter: number | null = null;
    if (o.spoilerChapter !== undefined && o.spoilerChapter !== null) {
      if (typeof o.spoilerChapter !== "number" || !Number.isFinite(o.spoilerChapter)) {
        return null;
      }
      spoilerChapter = Math.trunc(o.spoilerChapter);
    }
    return { isSpoiler: o.isSpoiler, spoilerChapter };
  } catch {
    return null;
  }
}

async function persistScanDebug(commentId: string, debug: CommentSpoilerScanDebug): Promise<void> {
  await prisma.comment.update({
    where: { id: commentId },
    data: { spoilerScanDebug: debug as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Loads the comment with image + book context, asks Anthropic for a JSON spoiler decision,
 * updates comment status, persists spoilerScanDebug, and notifies the author when hidden.
 */
export async function scanCommentForSpoilers(commentId: string): Promise<CommentSpoilerScanDebug | null> {
  const row = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      content: true,
      status: true,
      image: {
        select: {
          id: true,
          bookId: true,
          chapterNumberAtTime: true,
          book: { select: { title: true } },
        },
      },
      user: { select: { username: true } },
    },
  });

  if (!row) {
    return null;
  }

  const bookTitle = row.image.book.title;
  const imageChapter = row.image.chapterNumberAtTime;
  const base = {
    imageChapter,
    bookTitle,
    scannedAt: new Date().toISOString(),
  } satisfies Pick<CommentSpoilerScanDebug, "imageChapter" | "bookTitle" | "scannedAt">;

  if (row.status !== CommentStatus.VISIBLE) {
    const debug: CommentSpoilerScanDebug = {
      ...base,
      outcome: "skipped",
      errorMessage: `status was ${row.status}, not VISIBLE`,
    };
    await persistScanDebug(commentId, debug);
    return debug;
  }

  const userPayload = `Book title: ${bookTitle}\nChapter number (for this image): ${imageChapter}\nComment:\n${row.content}`;

  let rawModelText = "";
  let parsed: SpoilerScanParseResult | null = null;
  try {
    const { text } = await getAnthropicTextResponse(SCAN_SYSTEM, userPayload, 256);
    rawModelText = text;
    parsed = parseSpoilerDecision(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[comment-scan] Anthropic scan failed", { commentId, err });
    const debug: CommentSpoilerScanDebug = {
      ...base,
      outcome: "scan_failed",
      rawModelText: rawModelText || undefined,
      errorMessage: message,
    };
    await persistScanDebug(commentId, debug);
    return debug;
  }

  if (!parsed) {
    console.warn("[comment-scan] Unparseable model output; leaving comment visible", {
      commentId,
      rawModelText,
    });
    const debug: CommentSpoilerScanDebug = {
      ...base,
      outcome: "unparseable",
      rawModelText,
      parsedIsSpoiler: null,
    };
    await persistScanDebug(commentId, debug);
    return debug;
  }

  if (!parsed.isSpoiler) {
    const debug: CommentSpoilerScanDebug = {
      ...base,
      outcome: "safe",
      rawModelText,
      parsedIsSpoiler: false,
      spoilerChapter: parsed.spoilerChapter,
    };
    await persistScanDebug(commentId, debug);
    return debug;
  }

  const gateChapter =
    parsed.spoilerChapter != null && parsed.spoilerChapter > 0
      ? parsed.spoilerChapter
      : imageChapter;

  try {
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.HIDDEN_SPOILER,
        spoilerGateChapter: gateChapter,
      },
    });
  } catch (err) {
    console.error("[comment-scan] Failed to update comment status", { commentId, err });
    const debug: CommentSpoilerScanDebug = {
      ...base,
      outcome: "scan_failed",
      rawModelText,
      parsedIsSpoiler: true,
      spoilerChapter: parsed.spoilerChapter,
      errorMessage: "Failed to set HIDDEN_SPOILER",
    };
    await persistScanDebug(commentId, debug);
    return debug;
  }

  const debug: CommentSpoilerScanDebug = {
    ...base,
    outcome: "flagged",
    rawModelText,
    parsedIsSpoiler: true,
    spoilerChapter: parsed.spoilerChapter,
  };
  await persistScanDebug(commentId, debug);

  const bookId = row.image.bookId;
  const imageId = row.image.id;
  const link = `/gallery/${bookId}?image=${encodeURIComponent(imageId)}`;
  const chapterNote =
    parsed.spoilerChapter != null
      ? `chapter ${parsed.spoilerChapter}`
      : `chapter ${imageChapter}`;
  const message = `Your comment on "${bookTitle}" (${chapterNote}) was flagged as a possible spoiler and is under review. Reword it from the gallery or wait for a decision.`;

  await createNotification(row.userId, NotificationType.COMMENT_HIDDEN_PENDING, message, link);

  sendAdminEmail({
    category: AdminEmailCategory.SPOILER_FLAG,
    subjectDetail: `"${bookTitle}" - Ch. ${gateChapter}`,
    bodyLines: [
      { label: "Book", value: bookTitle },
      { label: "Image chapter", value: String(imageChapter) },
      {
        label: "Spoiler chapter",
        value:
          parsed.spoilerChapter != null ? String(parsed.spoilerChapter) : "(same as image chapter)",
      },
      { label: "Comment author", value: row.user.username ?? row.userId },
      { label: "Comment", value: row.content },
      { label: "Public Gallery", value: absoluteAppUrl(link) },
      { label: "Moderation queue", value: absoluteAppUrl("/dashboard?tab=comment-moderation&filter=spoiler") },
    ],
  });

  return debug;
}

export async function setCommentSpoilerScanPending(
  commentId: string,
  imageChapter: number,
  bookTitle: string,
): Promise<void> {
  const debug: CommentSpoilerScanDebug = {
    outcome: "pending",
    imageChapter,
    bookTitle,
    scannedAt: new Date().toISOString(),
  };
  await persistScanDebug(commentId, debug);
}
