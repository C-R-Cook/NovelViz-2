import { getCurrentUser } from "@/lib/auth";
import { chunkText, embedChunks } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHUNK_TX = { maxWait: 10_000, timeout: 300_000 } as const;
const CHUNK_INSERT_BATCH = 40;

type RouteContext = { params: Promise<{ id: string }> };

type ChunkRow = {
  chapterId: string;
  bookId: string;
  sequenceNumber: number;
  content: string;
  vector: string;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  if (book.status !== "draft") {
    return NextResponse.json(
      { error: "Finalise is only allowed when book status is draft" },
      { status: 400 },
    );
  }

  const createdChapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
  });

  if (createdChapters.length === 0) {
    return NextResponse.json(
      { error: "No chapters to finalise" },
      { status: 400 },
    );
  }

  try {
    const chunkStrings: string[] = [];
    const meta: { chapterId: string; sequenceNumber: number }[] = [];

    for (const ch of createdChapters) {
      const parts = chunkText(ch.rawText);
      let seq = 0;
      for (const c of parts) {
        seq += 1;
        chunkStrings.push(c);
        meta.push({ chapterId: ch.id, sequenceNumber: seq });
      }
    }

    if (chunkStrings.length === 0) {
      return NextResponse.json(
        { error: "All chapters are empty after chunking" },
        { status: 400 },
      );
    }

    const vectors = await embedChunks(chunkStrings);

    if (vectors.length !== chunkStrings.length) {
      throw new Error("Embedding count mismatch");
    }

    const rows: ChunkRow[] = chunkStrings.map((content, i) => {
      const vec = vectors[i]!;
      const vectorLiteral = `[${vec.join(",")}]`;
      return {
        chapterId: meta[i]!.chapterId,
        bookId,
        sequenceNumber: meta[i]!.sequenceNumber,
        content,
        vector: vectorLiteral,
      };
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.chunk.deleteMany({ where: { bookId } });

        for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
          const batch = rows.slice(i, i + CHUNK_INSERT_BATCH);
          const valueRows = batch.map(
            (row) =>
              Prisma.sql`(gen_random_uuid(), ${row.chapterId}, ${row.bookId}, ${row.sequenceNumber}, ${row.content}, ${row.vector}::vector, now(), now())`,
          );
          await tx.$executeRaw`
            INSERT INTO "Chunk" (id, "chapterId", "bookId", "sequenceNumber", content, embedding, "createdAt", "updatedAt")
            VALUES ${Prisma.join(valueRows, ", ")}
          `;
        }

        await tx.book.update({
          where: { id: bookId },
          data: { status: "ready_for_review" },
        });
      },
      CHUNK_TX,
    );

    const updated = await prisma.book.findUnique({ where: { id: bookId } });
    return NextResponse.json({
      ok: true,
      book: updated,
      chunks: rows.length,
    });
  } catch (e) {
    console.error("[finalise]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Finalise failed" },
      { status: 500 },
    );
  }
}
