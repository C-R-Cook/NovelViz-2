import anthropic from "@/lib/anthropic";
import { accountEnforcementApiGuard } from "@/lib/account-status-routing";
import { getCurrentUser } from "@/lib/auth";
import { embedChunksWithTokenUsage } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { aiFailureResponse } from "@/lib/ai-service-failure";
import { checkUsageLimit, consumeUsageAfterSuccess, getEffectiveLimits } from "@/lib/subscription";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const maxDuration = 120;
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

  const enforcementBlock = await accountEnforcementApiGuard(dbUser.id);
  if (enforcementBlock) return enforcementBlock;

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");
  if (!bookId || bookId.trim() === "") {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const queries = await prisma.query.findMany({
    where: { userId: dbUser.id, bookId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      questionText: true,
      responseText: true,
      chapterNumberAtTime: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ queries });
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

  const enforcementBlock = await accountEnforcementApiGuard(dbUser.id);
  if (enforcementBlock) return enforcementBlock;

  const [limitCheck, effectiveLimits] = await Promise.all([
    checkUsageLimit(dbUser.id, "query"),
    getEffectiveLimits(dbUser.id),
  ]);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: "LIMIT_REACHED",
        limitType: "query",
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

  let body: { bookId?: unknown; questionText?: unknown };
  try {
    body = (await request.json()) as { bookId?: unknown; questionText?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
  const questionText =
    typeof body.questionText === "string" ? body.questionText.trim() : "";

  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }
  if (!questionText) {
    return NextResponse.json({ error: "questionText is required" }, { status: 400 });
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

  let embeddingVec: number[];
  let embeddingTokens = 0;
  try {
    const { embeddings, embeddingTokens: et } = await embedChunksWithTokenUsage([questionText]);
    embeddingTokens = et;
    embeddingVec = embeddings[0] ?? [];
  } catch (e) {
    console.error("[api/query POST] embed", e);
    return aiFailureResponse(dbUser.id, "/api/query", bookId, e);
  }
  if (embeddingVec.length === 0) {
    return aiFailureResponse(dbUser.id, "/api/query", bookId, new Error("Empty embedding"));
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
    console.error("[api/query POST] vector search", e);
    return aiFailureResponse(dbUser.id, "/api/query", bookId, e);
  }

  const excerptBlocks = chunks.map((row, i) => {
    const n = i + 1;
    return `[Excerpt ${n}]: ${row.content}`;
  });
  const excerptsJoined = excerptBlocks.join("\n\n");

  const systemPrompt = `You are a reading companion for the book "${book.title}" by ${book.author}.
The reader is currently at chapter ${currentChapterNumber}.

You will be given excerpts from the book that are relevant to the reader's question. These excerpts only contain content up to and including the reader's current chapter.

Rules you must follow without exception:
1. Only answer using information explicitly present in the provided excerpts
2. If the answer is not in the excerpts, say so clearly — e.g. "Based on what you've read so far, this hasn't been revealed yet. You may find out more as you continue reading."
3. Never use your general knowledge about this book or its plot
4. Never reference events, characters, or details beyond what the excerpts contain
5. Keep answers conversational and focused on the reader's question
6. Do not reveal future plot points under any circumstances`;

  const userMessage = `Here are the relevant excerpts from the book:

${excerptsJoined}

My question: ${questionText}`;

  let responseText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  try {
    const candidates = getAnthropicModelCandidates();
    let lastErr: unknown = null;

    for (const model of candidates) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        promptTokens = message.usage?.input_tokens ?? 0;
        completionTokens = message.usage?.output_tokens ?? 0;
        const first = message.content[0];
        responseText =
          first && first.type === "text" ? first.text : "No text response from the model.";
        lastErr = null;
        break;
      } catch (err) {
        const maybeType = (err as { type?: string } | undefined)?.type;
        const maybeStatus = (err as { status?: number } | undefined)?.status;
        lastErr = err;
        // Try next configured model only for model-not-found style failures.
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
    console.error("[api/query POST] Anthropic error", e);
    return aiFailureResponse(dbUser.id, "/api/query", bookId, e);
  }

  if (responseText === "") {
    return aiFailureResponse(dbUser.id, "/api/query", bookId, new Error("Empty model response"));
  }

  await prisma.query.create({
    data: {
      userId: dbUser.id,
      bookId,
      chapterNumberAtTime: currentChapterNumber,
      questionText,
      responseText,
      promptTokens,
      completionTokens,
      embeddingTokens,
    },
  });

  try {
    await consumeUsageAfterSuccess(dbUser.id, "query", bookId);
  } catch (err) {
    console.error("[api/query POST] consumeUsageAfterSuccess error", err);
  }

  return NextResponse.json({ questionText, responseText });
}
