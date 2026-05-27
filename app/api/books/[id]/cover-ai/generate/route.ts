import { getCurrentUser } from "@/lib/auth";
import {
  buildCoverAiFalInputForCustomEndpoint,
  extractCoverAiFalImageUrl,
} from "@/lib/cover-ai-fal";
import { assembleCoverAiPrompt } from "@/lib/cover-ai-prompt";
import {
  canAccessBookCoverAi,
  resolveCoverAiQuotaExempt,
} from "@/lib/cover-ai-access";
import {
  findCoverAiModelEntry,
  getCoverAiAdminSettings,
} from "@/lib/cover-ai-settings";
import fal from "@/lib/fal";
import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { resolveDbUserFromSession } from "@/lib/resolve-db-user-from-session";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

function sniffImageMimeType(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

async function uploadCoverDraftFromUrl(options: {
  bookId: string;
  draftLeaf: string;
  imageUrl: string;
}): Promise<{ publicId: string; secureUrl: string }> {
  // Attempt 1: Cloudinary fetches remote URL (fast path).
  try {
    const result = await cloudinary.uploader.upload(options.imageUrl, {
      folder: `novelviz/cover-drafts/${options.bookId}`,
      public_id: options.draftLeaf,
      resource_type: "image",
      overwrite: false,
    });
    return { publicId: result.public_id, secureUrl: result.secure_url };
  } catch (e) {
    console.error("[cover-ai generate] Cloudinary remote fetch failed; falling back to buffer upload", e);
  }

  // Attempt 2: Download ourselves (handles transient remote issues), then upload data URI.
  const res = await fetch(options.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`Failed to download generated image (HTTP ${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = sniffImageMimeType(buf);
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `novelviz/cover-drafts/${options.bookId}`,
    public_id: options.draftLeaf,
    resource_type: "image",
    overwrite: false,
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}

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
    modelKey?: unknown;
    publisherPrompt?: unknown;
    overlayTitle?: unknown;
    overlayAuthor?: unknown;
    quotaExempt?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : "";
  const publisherPrompt =
    typeof body.publisherPrompt === "string" ? body.publisherPrompt : "";
  const overlayTitle = typeof body.overlayTitle === "string" ? body.overlayTitle : "";
  const overlayAuthor =
    typeof body.overlayAuthor === "string" ? body.overlayAuthor : "";
  const quotaExemptRequested = body.quotaExempt === true;

  if (!modelKey) {
    return NextResponse.json({ error: "modelKey is required" }, { status: 400 });
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      status: true,
      isPublicDomain: true,
      coverGenAttemptsConsumed: true,
      coverGenAttemptsGranted: true,
    },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (!canAccessBookCoverAi(dbUser.role, dbUser.id, book)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quotaExempt = resolveCoverAiQuotaExempt({
    role: dbUser.role,
    quotaExemptRequested,
    book,
  });

  const settings = await getCoverAiAdminSettings();
  const modelEntry = findCoverAiModelEntry(settings.modelsJson, modelKey);
  if (!modelEntry) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  const prompt = assembleCoverAiPrompt({
    basePromptPrefix: settings.basePromptPrefix,
    titlePromptTemplate: settings.titlePromptTemplate,
    authorPromptTemplate: settings.authorPromptTemplate,
    overlayTitle,
    overlayAuthor,
    publisherPrompt,
  });
  if (prompt.length < 8) {
    return NextResponse.json(
      { error: "Combined prompt is too short — please add details to your description." },
      { status: 400 },
    );
  }

  if (!quotaExempt) {
    const granted = book.coverGenAttemptsGranted ?? 0;
    const consumed = book.coverGenAttemptsConsumed ?? 0;
    if (consumed >= granted) {
      return NextResponse.json(
        {
          error: "No cover generations remaining for this book. Request more from NovelViz.",
          code: "COVER_AI_QUOTA_EXHAUSTED",
        },
        { status: 429 },
      );
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { coverGenAttemptsConsumed: { increment: 1 } },
    });
  }

  let falUrl: string;
  try {
    const resolved = buildCoverAiFalInputForCustomEndpoint(
      modelEntry.falEndpoint,
      prompt,
      modelEntry.inputProfile,
    );
    const result = await fal.subscribe(resolved.endpoint, { input: resolved.input });
    const nested = (result as { data?: unknown }).data;
    const url =
      extractCoverAiFalImageUrl(result) ??
      (nested ? extractCoverAiFalImageUrl(nested) : null) ??
      extractCoverAiFalImageUrl((nested as { data?: unknown })?.data);
    if (!url) {
      console.error("[cover-ai generate] unexpected fal response", result);
      return NextResponse.json({ error: "Image generation returned no URL" }, { status: 502 });
    }
    falUrl = url;
  } catch (e) {
    console.error("[cover-ai generate] fal error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 502 },
    );
  }

  const draftLeaf = randomUUID();
  let publicId: string;
  let secureUrl: string;
  try {
    const uploaded = await uploadCoverDraftFromUrl({
      bookId,
      draftLeaf,
      imageUrl: falUrl,
    });
    publicId = uploaded.publicId;
    secureUrl = uploaded.secureUrl;
  } catch (e) {
    console.error("[cover-ai generate] Cloudinary error", e);
    return NextResponse.json({ error: "Image storage failed" }, { status: 502 });
  }

  const refreshed = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      coverGenAttemptsConsumed: true,
      coverGenAttemptsGranted: true,
    },
  });

  const grantedNow = refreshed?.coverGenAttemptsGranted ?? 0;
  const consumedNow = refreshed?.coverGenAttemptsConsumed ?? 0;

  return NextResponse.json({
    imageUrl: secureUrl,
    publicId,
    remainingAttempts: quotaExempt ? null : Math.max(0, grantedNow - consumedNow),
    quotaExempt,
  });
}
