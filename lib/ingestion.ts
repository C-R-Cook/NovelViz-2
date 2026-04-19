import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const CHAPTER_HEADER =
  /^[\s\uFEFF]*((?:CHAPTER|PART|BOOK|VOLUME)\s+[^\n\r]+)$/gim;

function splitByWordCount(text: string, wordsPerChunk: number): { title: string; content: string }[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ title: "Full text", content: text.trim() || "" }];
  }

  const out: { title: string; content: string }[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk).join(" ");
    out.push({ title: `Part ${out.length + 1}`, content: slice });
  }
  return out;
}

/**
 * Detect chapters via common Project Gutenberg–style headings, or fall back to ~5000-word slices.
 */
export function detectChapters(text: string): { title: string; content: string }[] {
  const normalized = text.replace(/\r\n/g, "\n");

  const indices: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CHAPTER_HEADER.source, CHAPTER_HEADER.flags);
  while ((m = re.exec(normalized)) !== null) {
    indices.push(m.index);
  }

  if (indices.length < 2) {
    return splitByWordCount(normalized, 5000);
  }

  const chapters: { title: string; content: string }[] = [];

  const preamble = normalized.slice(0, indices[0]).trim();
  if (preamble) {
    chapters.push({ title: "Front matter", content: preamble });
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1]! : normalized.length;
    const block = normalized.slice(start, end);
    const nl = block.indexOf("\n");
    const title = (nl === -1 ? block : block.slice(0, nl)).trim();
    const content = (nl === -1 ? "" : block.slice(nl + 1)).trim();
    if (title || content) {
      chapters.push({ title: title || `Chapter ${chapters.length + 1}`, content });
    }
  }

  return chapters.length > 0 ? chapters : splitByWordCount(normalized, 5000);
}

/** ~chunkSize tokens per chunk, overlap tokens between consecutive chunks (1 token ≈ 4 chars). */
export function chunkText(content: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const charPerToken = 4;
  const chunkLen = Math.max(1, chunkSize * charPerToken);
  let overlapLen = overlap * charPerToken;
  if (overlapLen >= chunkLen) {
    overlapLen = Math.max(0, chunkLen - 1);
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + chunkLen, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = Math.max(0, end - overlapLen);
  }
  return chunks;
}

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

const EMBED_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

/** Batch embeddings (1536-dim for text-embedding-3-small). */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];

  const openai = getOpenAI();
  const out: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
    });

    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      out.push(row.embedding);
    }
  }

  return out;
}

const RENUMBER_OFFSET = 1_000_000;

/**
 * Reassign sequenceNumber to 1…n in creation order (matches ingest order when createdAt aligns).
 */
export async function renumberChapters(bookId: string): Promise<void> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { createdAt: "asc" },
  });
  if (chapters.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < chapters.length; i++) {
      await tx.chapter.update({
        where: { id: chapters[i]!.id },
        data: { sequenceNumber: RENUMBER_OFFSET + i },
      });
    }
    for (let i = 0; i < chapters.length; i++) {
      await tx.chapter.update({
        where: { id: chapters[i]!.id },
        data: { sequenceNumber: i + 1 },
      });
    }
  });
}

/** Keep denormalised currentChapterNumber in sync with chapter.sequenceNumber. */
export async function syncReadingProgressChapterNumbers(
  bookId: string,
): Promise<void> {
  const progresses = await prisma.readingProgress.findMany({
    where: { bookId },
  });
  for (const p of progresses) {
    const ch = await prisma.chapter.findUnique({
      where: { id: p.currentChapterId },
    });
    if (ch && ch.sequenceNumber !== p.currentChapterNumber) {
      await prisma.readingProgress.update({
        where: { id: p.id },
        data: { currentChapterNumber: ch.sequenceNumber },
      });
    }
  }
}
