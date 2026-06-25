import { getCurrentUser } from "@/lib/auth";
import { accountEnforcementApiGuard } from "@/lib/account-status-routing";
import { scanCommentForSpoilers, setCommentSpoilerScanPending } from "@/lib/comment-scan";
import {
  isCommentSpoilerScanDebugEnabled,
  parseCommentSpoilerScanDebug,
  shouldAwaitCommentSpoilerScan,
} from "@/lib/comment-spoiler-scan-debug";
import { getCommentViewerPresentation } from "@/lib/comment-visibility";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { CommentStatus, UserRole, type SpoilerProtection } from "@db";
import { after } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEN = 500;
const MIN_LEN = 1;

function normalizeContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length < MIN_LEN || t.length > MAX_LEN) return null;
  return t;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId")?.trim();
  if (!imageId) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 });
  }

  const sessionOverride = searchParams.get("session") === "true";
  const sessionUser = await getCurrentUser();

  let viewer: { id: string; role: UserRole } | null = null;
  let isAdmin = false;
  let userBookSpoiler: SpoilerProtection | null | undefined;
  let globalSpoilerProtection = true;
  let currentChapterNumber: number | undefined;

  if (sessionUser) {
    const dbUser = await resolveDbUserFromSession(sessionUser);
    if (dbUser) {
      viewer = { id: dbUser.id, role: dbUser.role };
      isAdmin = dbUser.role === UserRole.admin;
      globalSpoilerProtection = dbUser.globalSpoilerProtection;
    }
  }

  const image = await prisma.generatedImage.findFirst({
    where: {
      id: imageId,
      ...(isAdmin
        ? { book: { deletedAt: null } }
        : { isPublic: true, book: { status: "published", deletedAt: null } }),
    },
    select: { id: true, chapterNumberAtTime: true, bookId: true, userId: true },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (sessionUser && viewer && !sessionOverride && !isAdmin) {
    const [userBook, progress] = await Promise.all([
      prisma.userBook.findFirst({
        where: { userId: viewer.id, bookId: image.bookId, isActive: true },
        select: { spoilerProtection: true },
      }),
      prisma.readingProgress.findUnique({
        where: { userId_bookId: { userId: viewer.id, bookId: image.bookId } },
        select: { currentChapterNumber: true },
      }),
    ]);
    userBookSpoiler = userBook?.spoilerProtection;
    currentChapterNumber = progress?.currentChapterNumber;
  }

  const exposeScanDebug = isCommentSpoilerScanDebugEnabled();

  const rows = await prisma.comment.findMany({
    where: { imageId, status: { not: CommentStatus.DELETED } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      content: true,
      status: true,
      createdAt: true,
      spoilerGateChapter: true,
      spoilerModerationAt: true,
      ...(exposeScanDebug ? { spoilerScanDebug: true } : {}),
      user: { select: { username: true, name: true } },
    },
  });

  const comments = [];
  for (const row of rows) {
    const scanDebug = exposeScanDebug
      ? parseCommentSpoilerScanDebug(row.spoilerScanDebug)
      : null;
    const presentation = getCommentViewerPresentation({
      viewer,
      sessionOverride,
      comment: {
        status: row.status,
        userId: row.userId,
        spoilerGateChapter: row.spoilerGateChapter,
        spoilerModerationAt: row.spoilerModerationAt,
      },
      imageChapterNumber: image.chapterNumberAtTime,
      imageOwnerUserId: image.userId,
      userBookSpoiler,
      globalSpoilerProtection,
      currentChapterNumber,
      spoilerScanDebug: scanDebug,
    });
    if (!presentation.listVisible) continue;

    const canFlag =
      viewer !== null &&
      row.userId !== viewer.id &&
      (row.status === CommentStatus.VISIBLE ||
        (row.status === CommentStatus.HIDDEN_SPOILER && presentation.revealContent));

    const canEdit =
      presentation.isOwnComment &&
      (row.status === CommentStatus.VISIBLE ||
        row.status === CommentStatus.HIDDEN_SPOILER ||
        row.status === CommentStatus.PENDING_CONTENT_REVIEW);

    const canDelete =
      viewer !== null &&
      (row.userId === viewer.id || viewer.role === UserRole.admin);

    const canAdminModerateContent =
      isAdmin && row.status === CommentStatus.PENDING_CONTENT_REVIEW;
    const canAdminModerateSpoiler =
      isAdmin && row.status === CommentStatus.HIDDEN_SPOILER;
    const canAdminConfirmSpoilerGated =
      canAdminModerateSpoiler && row.spoilerModerationAt == null;

    comments.push({
      id: row.id,
      content: presentation.revealContent ? row.content : "",
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      username: row.user.username ?? row.user.name ?? "",
      isOwnComment: presentation.isOwnComment,
      spoilerLocked: presentation.spoilerLocked,
      lockMessage: presentation.lockMessage,
      chapterGap: presentation.chapterGap,
      spoilerGateChapter: presentation.spoilerGateChapter,
      showAuthorReview: presentation.showAuthorReview,
      showPendingSpoilerNotice: presentation.showPendingSpoilerNotice,
      showContentReviewNotice: presentation.showContentReviewNotice ?? false,
      showAuthorSpoilerConfirmedNotice: presentation.showAuthorSpoilerConfirmedNotice ?? false,
      noticeImageChapter: presentation.noticeImageChapter,
      canFlag,
      canEdit,
      canDelete,
      canAdminModerateContent,
      canAdminModerateSpoiler,
      canAdminConfirmSpoilerGated,
      ...(exposeScanDebug ? { spoilerScanDebug: scanDebug } : {}),
    });
  }

  const visibleCount = comments.length;

  return NextResponse.json({
    comments,
    visibleCount,
    totalVisible: visibleCount,
    ...(exposeScanDebug ? { spoilerScanDebugEnabled: true } : {}),
  });
}

export async function POST(request: Request) {
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
  const imageId = typeof b.imageId === "string" ? b.imageId.trim() : "";
  const content = normalizeContent(b.content);
  if (!imageId) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: `content must be between ${MIN_LEN} and ${MAX_LEN} characters` }, { status: 400 });
  }

  const image = await prisma.generatedImage.findFirst({
    where: { id: imageId, isPublic: true, book: { status: "published", deletedAt: null } },
    select: {
      id: true,
      chapterNumberAtTime: true,
      book: { select: { title: true } },
    },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const exposeScanDebug = isCommentSpoilerScanDebugEnabled();

  const comment = await prisma.comment.create({
    data: {
      imageId,
      userId: dbUser.id,
      content,
      status: CommentStatus.VISIBLE,
    },
    select: { id: true, createdAt: true },
  });

  if (exposeScanDebug) {
    await setCommentSpoilerScanPending(
      comment.id,
      image.chapterNumberAtTime,
      image.book.title,
    );
  }

  const runScan = async () => {
    await scanCommentForSpoilers(comment.id);
  };
  if (shouldAwaitCommentSpoilerScan()) {
    await runScan();
  } else {
    try {
      after(() => void runScan());
    } catch {
      void runScan();
    }
  }

  let spoilerScanDebug = null;
  let status: CommentStatus = CommentStatus.VISIBLE;
  if (exposeScanDebug) {
    const refreshed = await prisma.comment.findUnique({
      where: { id: comment.id },
      select: { status: true, spoilerScanDebug: true },
    });
    if (refreshed) {
      status = refreshed.status;
      spoilerScanDebug = parseCommentSpoilerScanDebug(refreshed.spoilerScanDebug);
    }
  }

  return NextResponse.json(
    {
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      status,
      ...(exposeScanDebug ? { spoilerScanDebug, spoilerScanDebugEnabled: true } : {}),
    },
    { status: 201 },
  );
}
