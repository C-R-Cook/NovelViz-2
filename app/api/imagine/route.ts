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

  let embeddingVec: number[];
  try {
    const batch = await embedChunks([userPrompt]);
    embeddingVec = batch[0] ?? [];
  } catch (e) {
    console.error("[api/imagine POST] embed", e);
    return NextResponse.json(
      { error: "Failed to embed prompt. Check OPENAI_API_KEY." },
      { status: 500 },
    );
  }
  if (embeddingVec.length === 0) {
    return NextResponse.json({ error: "Failed to embed prompt" }, { status: 500 });
  }

  const vectorStr = `[${embeddingVec.join(",")}]`;

  let chunks: ChunkRow[];
  try {
    chunks = await prisma.$queryRaw<ChunkRow[]>`
      SELECT c.id, c.content, ch."sequenceNumber"
      FROM "Chunk" c
      JOIN "Chapter" ch ON c."chapterId" = ch.id
      WHERE c."bookId" = ${bookId}
      AND ch."sequenceNumber" <= ${currentChapterNumber}
      ORDER BY c.embedding <=> ${vectorStr}::vector
      LIMIT 5
    `;
  } catch (e) {
    console.error("[api/imagine POST] vector search", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Similarity search failed" },
      { status: 500 },
    );
  }

  const excerptBlocks = chunks.map((row, i) => {
    const n = i + 1;
    return `[Excerpt ${n}]: ${row.content}`;
  });
  const excerptsJoined = excerptBlocks.join("\n\n");

  const systemPrompt = `You are an expert at writing prompts for AI image generation for the book "${book.title}" by ${book.author}.

The reader is currently at chapter ${currentChapterNumber}.
You will be given relevant excerpts from the book and the reader's image request.

Your job is to write a detailed, vivid image generation prompt that:
1. Only uses details explicitly mentioned in the provided excerpts
2. Never includes characters, places, or events beyond the reader's current chapter
3. Includes specific visual details from the text: clothing, appearance, lighting, atmosphere, setting
4. Is written in the style of a professional image generation prompt
5. Is 2-3 sentences maximum
6. Never mentions the book title or author in the prompt

Respond with ONLY the image generation prompt, nothing else.`;

  const userMessage = `Here are the relevant excerpts:

${excerptsJoined}

Reader's request: ${userPrompt}`;

  let enrichedPrompt = "";
  try {
    const candidates = getAnthropicModelCandidates();
    let lastErr: unknown = null;

    for (const model of candidates) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        const first = message.content[0];
        enrichedPrompt =
          first && first.type === "text" ? first.text.trim() : "";
        lastErr = null;
        break;
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

  await prisma.generatedImage.create({
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
  });

  return NextResponse.json({ imageUrl, fullPrompt: enrichedPrompt });
}
