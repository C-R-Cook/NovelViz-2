import anthropic from "@/lib/anthropic";
import fal from "@/lib/fal";
import { getCurrentUser } from "@/lib/auth";
import { embedChunks } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const maxDuration = 300;

const FAL_ENDPOINT = "fal-ai/flux/schnell" as const;
const DEFAULT_ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-sonnet-4-20250514"] as const;
const IMAGINE_DEBUG_FLAG = "IMAGINE_DEBUG";

type ChunkRow = {
  id: string;
  content: string;
  sequenceNumber: number;
};

function getAnthropicModelCandidates(): string[] {
  const raw = process.env.ANTHROPIC_MODEL;
  if (!raw) return [...DEFAULT_ANTHROPIC_MODELS];
  const parsed = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_ANTHROPIC_MODELS];
}

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
  const image = d.image;
  if (image && typeof image === "object") {
    const img = image as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  return null;
}

async function getAnthropicTextResponse(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const candidates = getAnthropicModelCandidates();
  let lastErr: unknown = null;

  for (const model of candidates) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const first = message.content[0];
      const text = first && first.type === "text" ? first.text.trim() : "";
      if (text) {
        return text;
      }
      lastErr = new Error("Anthropic returned empty text content");
    } catch (err) {
      const maybeType = (err as { type?: string } | undefined)?.type;
      const maybeStatus = (err as { status?: number } | undefined)?.status;
      lastErr = err;
      if (maybeType === "not_found_error" || maybeStatus === 404) {
        continue;
      }
      throw err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  throw new Error("No Anthropic model candidates available");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.clerkId },
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
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bookId?: unknown; userPrompt?: unknown };
  try {
    body = (await request.json()) as { bookId?: unknown; userPrompt?: unknown };
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

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true, author: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const currentChapterNumber = progress.currentChapterNumber;

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
  try {
    extractedSubject = await getAnthropicTextResponse(subjectExtractionSystemPrompt, userPrompt, 60);
  } catch (e) {
    console.error("[api/imagine POST] subject extraction", e);
    return NextResponse.json(
      {
        error:
          "Failed to extract primary subject. Configure a valid model with ANTHROPIC_MODEL if needed.",
      },
      { status: 502 },
    );
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
  try {
    const batch = await embedChunks([userPrompt, subjectForEmbedding]);
    promptEmbeddingVec = batch[0] ?? [];
    subjectEmbeddingVec = batch[1] ?? [];
  } catch (e) {
    console.error("[api/imagine POST] embed", e);
    return NextResponse.json(
      { error: "Failed to embed prompt. Check OPENAI_API_KEY." },
      { status: 500 },
    );
  }
  if (promptEmbeddingVec.length === 0 || subjectEmbeddingVec.length === 0) {
    return NextResponse.json({ error: "Failed to embed prompt" }, { status: 500 });
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Similarity search failed" },
      { status: 500 },
    );
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
  try {
    enrichedPrompt = await getAnthropicTextResponse(systemPrompt, userMessage, 300);
  } catch (e) {
    console.error("[api/imagine POST] Anthropic error", e);
    return NextResponse.json(
      {
        error:
          "Failed to enrich prompt. Configure a valid model with ANTHROPIC_MODEL if needed.",
      },
      { status: 502 },
    );
  }

  if (!enrichedPrompt) {
    return NextResponse.json(
      {
        error:
          "Failed to enrich prompt. Configure a valid model with ANTHROPIC_MODEL if needed.",
      },
      { status: 502 },
    );
  }

  let imageUrl: string;
  try {
    const result = await fal.subscribe(FAL_ENDPOINT, {
      input: {
        prompt: enrichedPrompt,
        image_size: "portrait_4_3",
        num_images: 1,
      },
    });
    const url = extractFalImageUrl(result.data);
    if (!url) {
      console.error("[api/imagine POST] unexpected fal response", result.data);
      return NextResponse.json({ error: "Image generation returned no URL" }, { status: 502 });
    }
    imageUrl = url;
  } catch (e) {
    console.error("[api/imagine POST] fal error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 502 },
    );
  }

  const created = await prisma.generatedImage.create({
    data: {
      userId: dbUser.id,
      bookId,
      chapterNumberAtTime: currentChapterNumber,
      userPrompt,
      fullPrompt: enrichedPrompt,
      imageUrl,
      isPublic: false,
      model: FAL_ENDPOINT,
    },
    select: {
      id: true,
      userPrompt: true,
      fullPrompt: true,
      imageUrl: true,
      chapterNumberAtTime: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    imageUrl,
    fullPrompt: enrichedPrompt,
    image: {
      id: created.id,
      userPrompt: created.userPrompt,
      fullPrompt: created.fullPrompt,
      imageUrl: created.imageUrl,
      chapterNumberAtTime: created.chapterNumberAtTime,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
