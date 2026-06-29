import { uploadFalImageUrlToCloudinary } from "@/lib/upload-prepared-image-to-cloudinary";
import { cloudinaryGalleryFolder } from "@/lib/cloudinary";
import {
  CONTENT_TEST_ENRICHED_PROMPT,
  CONTENT_TEST_PLACEHOLDER_IMAGE_URL,
  CONTENT_TEST_SUBJECT,
  getSupplierBlockReason,
  isSupplierBlocked,
  logSupplierSkipped,
} from "@/lib/content-test-mode";
import fal from "@/lib/fal";
import { accountEnforcementApiGuard } from "@/lib/account-status-routing";
import { getAnthropicTextResponse } from "@/lib/anthropic-text";
import { getCurrentUser } from "@/lib/auth";
import { embedChunksWithTokenUsage } from "@/lib/ingestion";
import { resolveImagineFal } from "@/lib/imagine-fal";
import { prisma } from "@/lib/prisma";
import { aiFailureResponse } from "@/lib/ai-service-failure";
import { checkUsageLimit, consumeUsageAfterSuccess, getEffectiveLimits } from "@/lib/subscription";
import { UserRole } from "@db";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const maxDuration = 300;
const IMAGINE_DEBUG_FLAG = "IMAGINE_DEBUG";

type ChunkRow = {
  id: string;
  content: string;
  sequenceNumber: number;
};

function isImagineDebugEnabled(): boolean {
  const raw = process.env[IMAGINE_DEBUG_FLAG];
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function extractFalImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const images = d.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
    const img = images[0] as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  const nested = d.data;
  if (nested && typeof nested === "object") {
    const nd = nested as Record<string, unknown>;
    const nestedImages = nd.images;
    if (Array.isArray(nestedImages) && nestedImages[0] && typeof nestedImages[0] === "object") {
      const img = nestedImages[0] as Record<string, unknown>;
      if (typeof img.url === "string") return img.url;
    }
  }
  const image = d.image;
  if (image && typeof image === "object") {
    const img = image as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true, role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId || bookId.trim() === "") {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const images = await prisma.generatedImage.findMany({
    where: { userId: dbUser.id, bookId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userPrompt: true,
      fullPrompt: true,
      imageUrl: true,
      isPublic: true,
      isFeatured: true,
      chapterNumberAtTime: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  const debugEnabled = isImagineDebugEnabled();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
    select: { id: true, role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enforcementBlock = await accountEnforcementApiGuard(dbUser.id);
  if (enforcementBlock) return enforcementBlock;

  const [limitCheck, effectiveLimits] = await Promise.all([
    checkUsageLimit(dbUser.id, "image"),
    getEffectiveLimits(dbUser.id),
  ]);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: "LIMIT_REACHED",
        limitType: "image",
        used: limitCheck.used,
        limit: limitCheck.limit,
        resetDate: limitCheck.resetDate,
        creditBalance: limitCheck.creditBalance,
        creditCost: limitCheck.creditCost,
        tier: effectiveLimits.tier,
        creditPurchasesEnabled: effectiveLimits.creditPurchasesEnabled,
      },
      { status: 429 },
    );
  }

  let body: { bookId?: unknown; userPrompt?: unknown; falImagineModel?: unknown };
  try {
    body = (await request.json()) as { bookId?: unknown; userPrompt?: unknown; falImagineModel?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
  const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";

  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }
  if (!userPrompt) {
    return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
  }

  if (dbUser.role !== UserRole.admin) {
    const { endpoint } = resolveImagineFal(dbUser.role, body.falImagineModel, "");
    if (!effectiveLimits.models.includes(endpoint)) {
      return NextResponse.json({ error: "MODEL_NOT_ALLOWED" }, { status: 403 });
    }
  }

  const progress = await prisma.readingProgress.findUnique({
    where: {
      userId_bookId: { userId: dbUser.id, bookId },
    },
  });
  if (!progress) {
    return NextResponse.json(
      { error: "No reading progress found for this book. Save your chapter first." },
      { status: 400 },
    );
  }

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { title: true, author: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const currentChapterNumber = progress.currentChapterNumber;

  let contentTestStubbed = false;

  const subjectExtractionSystemPrompt = `Extract the primary visual subject from this image request.
The subject is WHO or WHAT the image is primarily about.

Rules:
1. Ignore all camera instructions: angles, distances, directions, perspectives (e.g. "from above", "wide angle", "three quarter view", "overhead shot", "close up")
2. Ignore lighting instructions (e.g. "in dramatic lighting", "at night", "in shadow") — these are atmosphere, not subject
3. If the request mentions a CHARACTER and a LOCATION, the character is the subject (e.g. "Jonathan Harker at the castle" → "Jonathan Harker")
4. If the request mentions MULTIPLE CHARACTERS, identify the most prominent one — usually the first named or the one performing an action
5. If the request is purely about a LOCATION with no character (e.g. "the library interior", "the Carpathian mountains"), the location is the subject
6. If the request is about an OBJECT or ANIMAL, that is the subject
7. If the request describes an ACTION or SCENE with no specific named subject (e.g. "a battle scene", "a stormy night"), return the most visually dominant element

Examples:
- "Jonathan Harker arriving at Dracula's castle at night from above" → "Jonathan Harker"
- "Count Dracula and Mina in the library" → "Count Dracula"
- "The interior of the castle library" → "the castle library interior"
- "A wolf running through the forest" → "the wolf"
- "The three women in the moonlight" → "the three women"
- "A golden crucifix on a wooden table" → "the golden crucifix"

Return ONLY the subject as a short noun phrase. Nothing else.`;

  let extractedSubject = "";
  let subjectTokens = 0;
  if (isSupplierBlocked("anthropic")) {
    const reason = getSupplierBlockReason("anthropic")!;
    logSupplierSkipped("anthropic", reason);
    contentTestStubbed = true;
    extractedSubject = CONTENT_TEST_SUBJECT;
    subjectTokens = 0;
  } else {
    try {
      const subjectMessage = await getAnthropicTextResponse(
        subjectExtractionSystemPrompt,
        userPrompt,
        60,
      );
      extractedSubject = subjectMessage.text;
      subjectTokens = subjectMessage.promptTokens + subjectMessage.completionTokens;
    } catch (e) {
      console.error("[api/imagine POST] subject extraction", e);
      return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
    }
  }

  const normalizedSubject = extractedSubject.trim();
  const subjectForEmbedding = normalizedSubject.length > 0 ? normalizedSubject : userPrompt;
  if (debugEnabled) {
    console.info("[api/imagine POST][debug] subject extraction", {
      userId: dbUser.id,
      bookId,
      currentChapterNumber,
      userPrompt,
      extractedSubject: normalizedSubject,
      usedFallbackToUserPrompt: normalizedSubject.length === 0,
    });
  }

  let promptEmbeddingVec: number[];
  let subjectEmbeddingVec: number[];
  let embeddingTokens = 0;
  if (isSupplierBlocked("openai")) {
    contentTestStubbed = true;
  }
  try {
    const { embeddings, embeddingTokens: embTok } = await embedChunksWithTokenUsage([
      userPrompt,
      subjectForEmbedding,
    ]);
    embeddingTokens = embTok;
    promptEmbeddingVec = embeddings[0] ?? [];
    subjectEmbeddingVec = embeddings[1] ?? [];
  } catch (e) {
    console.error("[api/imagine POST] embed", e);
    return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
  }
  if (promptEmbeddingVec.length === 0 || subjectEmbeddingVec.length === 0) {
    return aiFailureResponse(dbUser.id, "/api/imagine", bookId, new Error("Empty embedding"));
  }

  const promptVectorStr = `[${promptEmbeddingVec.join(",")}]`;
  const subjectVectorStr = `[${subjectEmbeddingVec.join(",")}]`;

  let sceneChunks: ChunkRow[];
  let subjectChunks: ChunkRow[];
  try {
    sceneChunks = await prisma.$queryRaw<ChunkRow[]>`
      SELECT c.id, c.content, ch."sequenceNumber"
      FROM "Chunk" c
      JOIN "Chapter" ch ON c."chapterId" = ch.id
      WHERE c."bookId" = ${bookId}
      AND ch."sequenceNumber" <= ${currentChapterNumber}
      ORDER BY c.embedding <=> ${promptVectorStr}::vector
      LIMIT 5
    `;

    subjectChunks = await prisma.$queryRaw<ChunkRow[]>`
      SELECT c.id, c.content, ch."sequenceNumber"
      FROM "Chunk" c
      JOIN "Chapter" ch ON c."chapterId" = ch.id
      WHERE c."bookId" = ${bookId}
      AND ch."sequenceNumber" <= ${currentChapterNumber}
      ORDER BY c.embedding <=> ${subjectVectorStr}::vector
      LIMIT 5
    `;
  } catch (e) {
    console.error("[api/imagine POST] vector search", e);
    return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
  }

  const mergedChunks: ChunkRow[] = [];
  const seenChunkIds = new Set<string>();
  for (const row of [...subjectChunks, ...sceneChunks]) {
    if (seenChunkIds.has(row.id)) {
      continue;
    }
    mergedChunks.push(row);
    seenChunkIds.add(row.id);
    if (mergedChunks.length >= 8) {
      break;
    }
  }
  if (debugEnabled) {
    console.info("[api/imagine POST][debug] retrieval chunks", {
      userId: dbUser.id,
      bookId,
      currentChapterNumber,
      subjectChunkIds: subjectChunks.map((chunk) => chunk.id),
      sceneChunkIds: sceneChunks.map((chunk) => chunk.id),
      mergedChunkIds: mergedChunks.map((chunk) => chunk.id),
      mergedChunkCount: mergedChunks.length,
    });
  }

  const excerptBlocks = mergedChunks.map((row, i) => {
    const n = i + 1;
    return `[Excerpt ${n}]: ${row.content}`;
  });
  const excerptsJoined = excerptBlocks.join("\n\n");

  const systemPrompt = `You are an expert at writing prompts for AI image generation for the book "${book.title}" by ${book.author}.

The reader is currently at chapter ${currentChapterNumber}.
You will be given relevant excerpts from the book and the reader's image request.

The PRIMARY SUBJECT of this image is: ${subjectForEmbedding}

Your job is to write a detailed, vivid image generation prompt that:
1. Focuses entirely on the PRIMARY SUBJECT identified above
2. Only uses physical descriptions of the PRIMARY SUBJECT from the excerpts
3. Never blends attributes from different characters, locations, or objects
4. If the PRIMARY SUBJECT is a character, use only their specific physical description - never describe other characters present in the same scene
5. If the PRIMARY SUBJECT's appearance is not described in the excerpts, use period-appropriate generic visual traits without inventing named details
6. Never includes characters, places, or events beyond the reader's current chapter
7. Is written in the style of a professional image generation prompt
8. Is 2-3 sentences maximum
9. Never mentions the book title or author in the prompt

Respond with ONLY the image generation prompt, nothing else.`;

  const userMessage = `Here are the relevant excerpts:

${excerptsJoined}

Reader's request: ${userPrompt}`;

  let enrichedPrompt = "";
  let promptTokens = 0;
  let completionTokens = 0;
  if (isSupplierBlocked("anthropic")) {
    const reason = getSupplierBlockReason("anthropic")!;
    logSupplierSkipped("anthropic", reason);
    contentTestStubbed = true;
    enrichedPrompt = CONTENT_TEST_ENRICHED_PROMPT;
    promptTokens = 0;
    completionTokens = 0;
  } else {
    try {
      const enrichMessage = await getAnthropicTextResponse(systemPrompt, userMessage, 300);
      enrichedPrompt = enrichMessage.text;
      promptTokens = enrichMessage.promptTokens;
      completionTokens = enrichMessage.completionTokens;
    } catch (e) {
      console.error("[api/imagine POST] Anthropic error", e);
      return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
    }
  }

  if (!enrichedPrompt) {
    return aiFailureResponse(dbUser.id, "/api/imagine", bookId, new Error("Empty enriched prompt"));
  }

  let imageUrl: string;
  let modelStored: string;
  let finalImageUrl: string;
  const generatedImageId = randomUUID();

  if (isSupplierBlocked("fal")) {
    const reason = getSupplierBlockReason("fal")!;
    logSupplierSkipped("fal", reason);
    contentTestStubbed = true;
    const resolved = resolveImagineFal(dbUser.role, body.falImagineModel, enrichedPrompt);
    modelStored = resolved.modelStored;
    imageUrl = CONTENT_TEST_PLACEHOLDER_IMAGE_URL;
    finalImageUrl = CONTENT_TEST_PLACEHOLDER_IMAGE_URL;
  } else {
    try {
      const resolved = resolveImagineFal(dbUser.role, body.falImagineModel, enrichedPrompt);
      modelStored = resolved.modelStored;
      const result = await fal.subscribe(resolved.endpoint, { input: resolved.input });
      const url =
        extractFalImageUrl(result) ??
        extractFalImageUrl((result as { data?: unknown }).data) ??
        extractFalImageUrl((result as { data?: { data?: unknown } }).data?.data);
      if (!url) {
        console.error("[api/imagine POST] unexpected fal response", result);
        return aiFailureResponse(dbUser.id, "/api/imagine", bookId, new Error("No image URL"));
      }
      imageUrl = url;
    } catch (e) {
      console.error("[api/imagine POST] fal error", e);
      return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
    }

    try {
      const uploaded = await uploadFalImageUrlToCloudinary({
        imageUrl,
        folder: cloudinaryGalleryFolder(),
        publicId: generatedImageId,
        overwrite: false,
      });
      finalImageUrl = uploaded.secureUrl;
    } catch (e) {
      console.error("[api/imagine POST] cloudinary upload", e);
      return aiFailureResponse(dbUser.id, "/api/imagine", bookId, e);
    }
  }

  const created = await prisma.generatedImage.create({
    data: {
      id: generatedImageId,
      userId: dbUser.id,
      bookId,
      chapterNumberAtTime: currentChapterNumber,
      userPrompt,
      fullPrompt: enrichedPrompt,
      imageUrl: finalImageUrl,
      isPublic: false,
      model: modelStored,
      promptTokens,
      completionTokens,
      embeddingTokens,
      subjectTokens,
    },
    select: {
      id: true,
      userPrompt: true,
      fullPrompt: true,
      imageUrl: true,
      isPublic: true,
      isFeatured: true,
      chapterNumberAtTime: true,
      createdAt: true,
    },
  });

  try {
    await consumeUsageAfterSuccess(dbUser.id, "image", bookId);
  } catch (err) {
    console.error("[api/imagine POST] consumeUsageAfterSuccess error", err);
  }

  return NextResponse.json({
    imageUrl: finalImageUrl,
    fullPrompt: enrichedPrompt,
    image: {
      id: created.id,
      userPrompt: created.userPrompt,
      fullPrompt: created.fullPrompt,
      imageUrl: created.imageUrl,
      isPublic: created.isPublic,
      isFeatured: created.isFeatured,
      chapterNumberAtTime: created.chapterNumberAtTime,
      createdAt: created.createdAt.toISOString(),
    },
    ...(contentTestStubbed ? { contentTestStubbed: true } : {}),
  });
}
