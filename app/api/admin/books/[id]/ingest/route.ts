import { getCurrentUser } from "@/lib/auth";
import cloudinary from "@/lib/cloudinary";
import {
  chunkText,
  embedChunks,
  extractEpubCover,
  extractEpubMetadataFromOpf,
  openEpubPackage,
  processBook,
} from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";
import { Prisma } from "@db";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Allow long ingest on Vercel / similar (seconds). Align with transaction timeouts below. */
export const maxDuration = 300;

/** Prisma interactive transactions default to 5s — chunk inserts often exceed that. */
const CHAPTER_TX = { maxWait: 10_000, timeout: 120_000 } as const;
/** Keep below `maxDuration` (seconds) on serverless; raise both for very large books. */
const CHUNK_TX = { maxWait: 10_000, timeout: 300_000 } as const;

/** Rows per INSERT — fewer round trips than one INSERT per chunk. */
const CHUNK_INSERT_BATCH = 40;

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
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

type RouteContext = { params: Promise<{ id: string }> };

type ChunkRow = {
  chapterId: string;
  bookId: string;
  sequenceNumber: number;
  content: string;
  vector: string;
};

/** Ingest allowed before catalogue publish; `ready_for_review` can re-upload before publishing. */
const INGEST_ALLOWED: BookStatus[] = [
  "draft",
  "ready_for_review",
  "published",
  "unlisted",
];

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && book.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!INGEST_ALLOWED.includes(book.status)) {
    return NextResponse.json(
      {
        error:
          "Ingest is only allowed when status is draft, ready_for_review, published, or unlisted",
      },
      { status: 400 },
    );
  }

  const previousStatus = book.status;

  let buffer: Buffer;
  let filename: string;
  let applyEpubMetadata = false;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".epub")) {
      return NextResponse.json(
        { error: "Only .epub and .txt files are accepted" },
        { status: 400 },
      );
    }
    applyEpubMetadata = formData.get("applyEpubMetadata") === "true";
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name;
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  await prisma.book.update({
    where: { id: bookId },
    data: { status: "processing" },
  });

  try {
    if (filename.toLowerCase().endsWith(".epub") && applyEpubMetadata) {
      try {
        const { opfXml } = await openEpubPackage(buffer);
        const m = extractEpubMetadataFromOpf(opfXml);
        const data: Prisma.BookUpdateInput = {};
        if (m.title) data.title = m.title.slice(0, 500);
        if (m.author) data.author = m.author.slice(0, 500);
        if (m.description != null && m.description.length > 0) {
          data.description = m.description;
        }
        if (m.genre) data.genre = m.genre;
        if (m.publishedYear != null) data.publishedYear = m.publishedYear;
        if (Object.keys(data).length > 0) {
          await prisma.book.update({ where: { id: bookId }, data });
        }
      } catch (e) {
        console.warn("[ingest] EPUB metadata from OPF skipped:", e);
      }
    }

    const chaptersIn = await processBook(buffer, filename);

    if (chaptersIn.length === 0) {
      throw new Error(
        "No chapters were extracted from this file. For EPUB, try another export or confirm the archive is not corrupt; for .txt, ensure the file has body text.",
      );
    }

    await prisma.$transaction(
      async (tx) => {
        // ReadingProgress.currentChapterId uses onDelete: Restrict — clear before chapters go away.
        await tx.readingProgress.deleteMany({ where: { bookId } });
        await tx.chapter.deleteMany({ where: { bookId } });

        for (let i = 0; i < chaptersIn.length; i++) {
          const ch = chaptersIn[i]!;
          await tx.chapter.create({
            data: {
              bookId,
              sequenceNumber: i + 1,
              title: ch.title.slice(0, 500) || null,
              rawText: ch.content,
            },
          });
        }
      },
      CHAPTER_TX,
    );

    if (filename.toLowerCase().endsWith(".epub")) {
      try {
        const { zip, opfXml, opfDir } = await openEpubPackage(buffer);
        const coverBuf = await extractEpubCover(zip, opfXml, opfDir);
        if (coverBuf && coverBuf.length > 0) {
          const mime = sniffImageMimeType(coverBuf);
          const dataUri = `data:${mime};base64,${coverBuf.toString("base64")}`;
          const result = await cloudinary.uploader.upload(dataUri, {
            folder: "novelviz/covers",
            public_id: bookId,
            overwrite: true,
            transformation: [{ width: 400, height: 600, crop: "fit" }],
            resource_type: "image",
          });
          await prisma.book.update({
            where: { id: bookId },
            data: { coverImageUrl: result.secure_url },
          });
        }
      } catch (e) {
        console.warn("[ingest] EPUB cover extraction or upload skipped:", e);
      }
    }

    const createdChapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { sequenceNumber: "asc" },
    });

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
      chapters: createdChapters.length,
      chunks: rows.length,
    });
  } catch (e) {
    console.error("[ingest]", e);
    await prisma.book.update({
      where: { id: bookId },
      data: { status: previousStatus },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 },
    );
  }
}
