import { getCurrentUser } from "@/lib/auth";
import { accountEnforcementApiGuard } from "@/lib/account-status-routing";
import { scanCommentForSpoilers } from "@/lib/comment-scan";
import { createNotification, notifyUsersWithRole } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { CommentStatus, NotificationType, UserRole } from "@db";
import { after } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_LEN = 500;
const MIN_LEN = 1;

type RouteContext = { params: Promise<{ commentId: string }> };

function normalizeContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length < MIN_LEN || t.length > MAX_LEN) return null;
  return t;
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enforcementBlock = await accountEnforcementApiGuard(dbUser.id);
  if (enforcementBlock) return enforcementBlock;

  const { commentId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const action = b.action;
  if (
    action !== "reword" &&
    action !== "reinstate" &&
    action !== "confirm_spoiler" &&
    action !== "moderate_content"
  ) {
    return NextResponse.json(
      { error: "action must be reword, reinstate, confirm_spoiler, or moderate_content" },
      { status: 400 },
    );
  }

  const disposition =
    typeof b.disposition === "string" && (b.disposition === "keep" || b.disposition === "delete")
      ? b.disposition
      : "keep";

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      status: true,
      updatedAt: true,
      image: {
        select: {
          id: true,
          bookId: true,
          book: { select: { title: true } },
        },
      },
    },
  });

  if (!comment || comment.status === CommentStatus.DELETED) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAdminUser = dbUser.role === UserRole.admin;
  const isAuthor = comment.userId === dbUser.id;

  const bookId = comment.image.bookId;
  const imageId = comment.image.id;
  const modLink = `/gallery/${bookId}?image=${encodeURIComponent(imageId)}`;

  if (action === "reword") {
    if (!isAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      comment.status !== CommentStatus.VISIBLE &&
      comment.status !== CommentStatus.HIDDEN_SPOILER &&
      comment.status !== CommentStatus.PENDING_CONTENT_REVIEW
    ) {
      return NextResponse.json({ error: "Comment cannot be edited in its current state" }, { status: 400 });
    }
    const nextContent = normalizeContent(b.content);
    if (!nextContent) {
      return NextResponse.json({ error: `content must be between ${MIN_LEN} and ${MAX_LEN} characters` }, { status: 400 });
    }

    if (comment.status === CommentStatus.PENDING_CONTENT_REVIEW) {
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { content: nextContent },
        select: { id: true, content: true, status: true, updatedAt: true },
      });
      return NextResponse.json({
        id: updated.id,
        content: updated.content,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: nextContent,
        status: CommentStatus.VISIBLE,
        spoilerGateChapter: null,
        spoilerModerationAt: null,
      },
      select: { id: true, content: true, status: true, updatedAt: true },
    });

    const runScan = () => {
      void scanCommentForSpoilers(updated.id);
    };
    try {
      after(runScan);
    } catch {
      runScan();
    }

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  if (action === "reinstate") {
    if (!isAuthor && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (comment.status !== CommentStatus.HIDDEN_SPOILER) {
      return NextResponse.json({ error: "Only hidden comments can be reinstated" }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.VISIBLE,
        spoilerGateChapter: null,
        spoilerModerationAt: null,
      },
      select: { id: true, status: true, updatedAt: true },
    });

    const bookTitle = comment.image.book.title;
    if (isAdminUser) {
      await createNotification(
        comment.userId,
        NotificationType.COMMENT_RELEASED,
        `Your comment on "${bookTitle}" was reviewed — it is not a spoiler and is visible to everyone again.`,
        modLink,
      );
    } else if (isAuthor) {
      notifyUsersWithRole(
        UserRole.admin,
        NotificationType.COMMENT_REINSTATED,
        "A reader reinstated a comment that had been hidden as a possible spoiler.",
        modLink,
      );
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  if (action === "confirm_spoiler") {
    if (isAdminUser && comment.status === CommentStatus.HIDDEN_SPOILER) {
      const bookTitle = comment.image.book.title;
      if (disposition === "delete") {
        await prisma.comment.update({
          where: { id: commentId },
          data: { status: CommentStatus.DELETED, spoilerModerationAt: new Date() },
        });
        await createNotification(
          comment.userId,
          NotificationType.COMMENT_SPOILER_REMOVED,
          `Your comment on "${bookTitle}" was confirmed as a spoiler and removed.`,
          modLink,
        );
        return NextResponse.json({ id: commentId, status: CommentStatus.DELETED, deleted: true });
      }

      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { spoilerModerationAt: new Date() },
        select: { id: true, status: true, updatedAt: true, spoilerGateChapter: true },
      });
      const gate = updated.spoilerGateChapter;
      const gateNote = gate != null ? `chapter ${gate}` : "the flagged chapter";
      await createNotification(
        comment.userId,
        NotificationType.COMMENT_SPOILER_CONFIRMED_GATED,
        `Your comment on "${bookTitle}" was confirmed as a spoiler. It stays on the image but is locked for readers before ${gateNote}.`,
        modLink,
      );
      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      });
    }
    if (!isAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (comment.status !== CommentStatus.VISIBLE) {
      return NextResponse.json({ error: "confirm_spoiler applies to visible comments only" }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { status: CommentStatus.HIDDEN_SPOILER },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  if (action === "moderate_content") {
    if (!isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (comment.status !== CommentStatus.PENDING_CONTENT_REVIEW) {
      return NextResponse.json({ error: "Comment is not awaiting content review" }, { status: 400 });
    }
    const contentDisposition =
      typeof b.disposition === "string" && (b.disposition === "restore" || b.disposition === "delete")
        ? b.disposition
        : null;
    if (!contentDisposition) {
      return NextResponse.json({ error: "disposition must be restore or delete" }, { status: 400 });
    }
    const bookTitle = comment.image.book.title;
    if (contentDisposition === "delete") {
      await prisma.comment.update({
        where: { id: commentId },
        data: { status: CommentStatus.DELETED },
      });
      await createNotification(
        comment.userId,
        NotificationType.COMMENT_FLAGGED_REMOVED,
        `Your comment on "${bookTitle}" was removed after a content review.`,
        modLink,
      );
      return NextResponse.json({ id: commentId, status: CommentStatus.DELETED, deleted: true });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.VISIBLE,
        spoilerGateChapter: null,
        spoilerModerationAt: null,
      },
      select: { id: true, status: true, updatedAt: true },
    });
    await createNotification(
      comment.userId,
      NotificationType.COMMENT_FLAGGED_RESTORED,
      `Your comment on "${bookTitle}" was reviewed and is visible again.`,
      modLink,
    );
    const runScan = () => {
      void scanCommentForSpoilers(updated.id);
    };
    try {
      after(runScan);
    } catch {
      runScan();
    }
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enforcementBlock = await accountEnforcementApiGuard(dbUser.id);
  if (enforcementBlock) return enforcementBlock;

  const { commentId } = await context.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      status: true,
      userId: true,
      image: {
        select: {
          id: true,
          bookId: true,
          book: { select: { title: true } },
        },
      },
    },
  });

  if (!comment || comment.status === CommentStatus.DELETED) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAdminUser = dbUser.role === UserRole.admin;
  const isAuthor = comment.userId === dbUser.id;
  if (!isAdminUser && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookId = comment.image.bookId;
  const imageId = comment.image.id;
  const modLink = `/gallery/${bookId}?image=${encodeURIComponent(imageId)}`;
  const bookTitle = comment.image.book.title;

  await prisma.comment.update({
    where: { id: commentId },
    data: { status: CommentStatus.DELETED },
  });

  if (isAdminUser && !isAuthor) {
    await createNotification(
      comment.userId,
      NotificationType.COMMENT_FLAGGED_REMOVED,
      `A moderator removed your comment on "${bookTitle}".`,
      modLink,
    );
  }

  return NextResponse.json({ ok: true });
}
