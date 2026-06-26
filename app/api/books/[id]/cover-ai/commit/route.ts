import { getCurrentUser } from "@/lib/auth";
import {
  canAccessBookCoverAi,
  isCoverAiDraftPublicIdForBook,
} from "@/lib/cover-ai-access";
import cloudinary, { cloudinaryCoverAiFolder } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUser = await resolveDbUserFromSession(sessionUser);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  let body: {
    chosenPublicId?: unknown;
    chosenImageUrl?: unknown;
    discardPublicIds?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chosenPublicId =
    typeof body.chosenPublicId === "string" ? body.chosenPublicId.trim() : "";
  const chosenImageUrl =
    typeof body.chosenImageUrl === "string" ? body.chosenImageUrl.trim() : "";
  const discardRaw = body.discardPublicIds;

  if (!chosenPublicId) {
    return NextResponse.json({ error: "chosenPublicId is required" }, { status: 400 });
  }
  if (!chosenImageUrl.startsWith("https://") || !chosenImageUrl.includes("res.cloudinary.com")) {
    return NextResponse.json(
      { error: "chosenImageUrl must be a Cloudinary HTTPS URL" },
      { status: 400 },
    );
  }
  if (!chosenImageUrl.includes(`cover-drafts/${bookId}/`)) {
    return NextResponse.json({ error: "Image is not a draft for this book" }, { status: 400 });
  }

  const discardPublicIds =
    Array.isArray(discardRaw) && discardRaw.every((x) => typeof x === "string")
      ? (discardRaw as string[]).map((s) => s.trim()).filter(Boolean)
      : [];

  if (!chosenPublicId) {
    return NextResponse.json({ error: "chosenPublicId is required" }, { status: 400 });
  }
  if (!isCoverAiDraftPublicIdForBook(bookId, chosenPublicId)) {
    return NextResponse.json({ error: "Invalid draft image" }, { status: 400 });
  }
  for (const pid of discardPublicIds) {
    if (!isCoverAiDraftPublicIdForBook(bookId, pid)) {
      return NextResponse.json({ error: "Invalid discard id" }, { status: 400 });
    }
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (!canAccessBookCoverAi(dbUser.role, dbUser.id, book)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let secureUrl: string;
  try {
    const result = await cloudinary.uploader.upload(chosenImageUrl, {
      folder: cloudinaryCoverAiFolder(),
      public_id: bookId,
      overwrite: true,
      transformation: [{ width: 400, height: 600, crop: "fit" }],
      resource_type: "image",
    });
    secureUrl = result.secure_url;
  } catch (e) {
    console.error("[cover-ai commit]", e);
    return NextResponse.json({ error: "Failed to publish cover" }, { status: 502 });
  }

  const merged = [...new Set([...discardPublicIds, chosenPublicId])];
  for (const pid of merged) {
    try {
      await cloudinary.uploader.destroy(pid, { resource_type: "image" });
    } catch {
      // best-effort cleanup
    }
  }

  const [updated, chapterCount] = await prisma.$transaction([
    prisma.book.update({
      where: { id: bookId },
      data: { coverImageUrl: secureUrl, coverIsAiGenerated: true },
    }),
    prisma.chapter.count({ where: { bookId } }),
  ]);

  return NextResponse.json({
    book: {
      ...updated,
      chapterCount,
    },
    coverImageUrl: secureUrl,
  });
}
