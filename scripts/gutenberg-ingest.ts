/**
 * Bulk Gutenberg ingestion CLI.
 *
 * GUTENBERG_ADMIN_USER_ID — DB id of admin user (ownerId for imported books).
 * Find with: SELECT id FROM "User" WHERE role = 'admin' LIMIT 1;
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import cloudinary from "@/lib/cloudinary";
import {
  OPENAI_EMBEDDING_USD_PER_M,
  OPENAI_GPT4O_MINI_USD_PER_M_INPUT,
  OPENAI_GPT4O_MINI_USD_PER_M_OUTPUT,
} from "@/lib/costs";
import { chunkText, embedChunks, processBook } from "@/lib/ingestion";
import { fetchOpenLibraryMetadata } from "@/lib/open-library";
import { prisma } from "@/lib/prisma";
import { BookStatus, Prisma, UserRole } from "@db";
import { QUEUE_PATH } from "./lib/gutenberg-filters";
import type { GutenbergQueueFile, QueueEntry } from "./lib/gutenberg-types";

const LOG = "[gutenberg-ingest]";
const MAX_EPUB_BYTES = 4.5 * 1024 * 1024;
const CHAPTER_TX = { maxWait: 10_000, timeout: 120_000 } as const;
const CHUNK_TX = { maxWait: 10_000, timeout: 300_000 } as const;
const CHUNK_INSERT_BATCH = 40;
const THROTTLE_MS = 2000;
const DRY_RUN_THROTTLE_MS = 100;

type ChunkRow = {
  chapterId: string;
  bookId: string;
  sequenceNumber: number;
  content: string;
  vector: string;
};

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const resume = process.argv.includes("--resume");
  const limitIdx = process.argv.indexOf("--limit");
  const limit =
    limitIdx !== -1 && process.argv[limitIdx + 1]
      ? Number.parseInt(process.argv[limitIdx + 1]!, 10)
      : null;
  return { dryRun, resume, limit: Number.isFinite(limit) && limit! > 0 ? limit! : null };
}

async function warnTitleAuthorOverlap(entry: QueueEntry): Promise<void> {
  const overlap = await prisma.book.findFirst({
    where: {
      deletedAt: null,
      title: { equals: entry.title.trim(), mode: "insensitive" },
      author: { equals: entry.authorDisplay.trim(), mode: "insensitive" },
      OR: [{ gutenbergId: null }, { gutenbergId: { not: entry.gutenbergId } }],
    },
    select: { id: true, title: true, gutenbergId: true, status: true },
  });
  if (overlap) {
    console.warn(
      `${LOG} [WARN] Title/author overlap: "${entry.title}" matches existing book id=${overlap.id} ` +
        `(gutenbergId=${overlap.gutenbergId ?? "null"}, status=${overlap.status}) — continuing`,
    );
  }
}

async function uploadCoverBuffer(
  bookId: string,
  coverBuf: Buffer,
  dryRun: boolean,
): Promise<string | null> {
  if (dryRun) {
    console.log(`  → Would upload cover to Cloudinary (public_id: ${bookId})`);
    return null;
  }
  const mime = sniffImageMimeType(coverBuf);
  const dataUri = `data:${mime};base64,${coverBuf.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "novelviz/covers",
    public_id: bookId,
    overwrite: true,
    transformation: [{ width: 400, height: 600, crop: "fit" }],
    resource_type: "image",
  });
  return result.secure_url;
}

async function resolveCoverUrl(
  bookId: string,
  entry: QueueEntry,
  dryRun: boolean,
): Promise<string | null> {
  if (dryRun) {
    console.log(`  → Would fetch cover from Open Library or Gutendex`);
    return null;
  }

  const ol = await fetchOpenLibraryMetadata(entry.title, entry.authorDisplay);
  if (ol.coverId) {
    try {
      const url = `https://covers.openlibrary.org/b/id/${ol.coverId}-L.jpg`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const uploaded = await uploadCoverBuffer(bookId, buf, false);
        if (uploaded) return uploaded;
      }
    } catch (e) {
      console.warn(`${LOG} Open Library cover fetch failed:`, e);
    }
  }

  if (entry.gutendexCoverUrl) {
    try {
      const res = await fetch(entry.gutendexCoverUrl, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return uploadCoverBuffer(bookId, buf, false);
      }
    } catch (e) {
      console.warn(`${LOG} Gutendex cover fetch failed:`, e);
    }
  }

  return null;
}

async function rollbackBook(bookId: string, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  try {
    await prisma.book.delete({ where: { id: bookId } });
  } catch (e) {
    console.error(`${LOG} Rollback failed for book ${bookId}:`, e);
  }
}

async function runIngestPipeline(
  bookId: string,
  epubBuffer: Buffer,
  dryRun: boolean,
): Promise<{ chapters: number; chunks: number; genre: string | null }> {
  const processed = await processBook(epubBuffer, "book.epub");
  const chaptersIn = processed.chapters;

  if (chaptersIn.length === 0) {
    throw new Error("No chapters extracted from EPUB");
  }

  // Deliberately stricter than POST /api/admin/books/[id]/ingest: unclassified books stay
  // draft with no chunks so we do not pollute the vector index.
  if (!processed.genre) {
    if (!dryRun) {
      await prisma.book.update({
        where: { id: bookId },
        data: {
          status: BookStatus.draft,
          genre: null,
          ingestionPromptTokens: processed.ingestionPromptTokens,
          ingestionCompletionTokens: processed.ingestionCompletionTokens,
        },
      });
    }
    throw new Error("SKIP-GENRE: genre classification failed or returned no match");
  }

  if (dryRun) {
    let chunkCount = 0;
    for (const ch of chaptersIn) {
      chunkCount += chunkText(ch.content).length;
    }
    console.log(
      `  → Would create ${chaptersIn.length} chapters, ${chunkCount} chunks, genre: ${processed.genre}`,
    );
    return { chapters: chaptersIn.length, chunks: chunkCount, genre: processed.genre };
  }

  await prisma.$transaction(
    async (tx) => {
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

  const rows: ChunkRow[] = chunkStrings.map((content, i) => ({
    chapterId: meta[i]!.chapterId,
    bookId,
    sequenceNumber: meta[i]!.sequenceNumber,
    content,
    vector: `[${vectors[i]!.join(",")}]`,
  }));

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
        data: {
          status: BookStatus.pending_review,
          genre: processed.genre,
          ingestionPromptTokens: processed.ingestionPromptTokens,
          ingestionCompletionTokens: processed.ingestionCompletionTokens,
        },
      });
    },
    CHUNK_TX,
  );

  return {
    chapters: createdChapters.length,
    chunks: rows.length,
    genre: processed.genre,
  };
}

async function enrichOpenLibrary(bookId: string, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, title: true, author: true, description: true, publishedYear: true },
  });
  if (!book) return;
  try {
    const ol = await fetchOpenLibraryMetadata(book.title, book.author);
    const updateData: Prisma.BookUpdateInput = { openLibraryKey: ol.openLibraryKey };
    if (ol.description && (!book.description || book.description.trim() === "")) {
      updateData.description = ol.description;
    }
    if (ol.firstPublishYear && !book.publishedYear) {
      updateData.publishedYear = ol.firstPublishYear;
    }
    await prisma.book.update({ where: { id: bookId }, data: updateData });
    console.log(
      `  → Open Library: enriched (publishedYear: ${ol.firstPublishYear ?? "n/a"})`,
    );
  } catch (e) {
    console.warn(`${LOG} Open Library enrichment failed (non-fatal):`, e);
  }
}

async function processEntry(
  entry: QueueEntry,
  index: number,
  total: number,
  adminUserId: string,
  dryRun: boolean,
): Promise<"ok" | "skip" | "fail" | "skip-genre"> {
  const label = `[${index}/${total}]`;
  const started = Date.now();
  console.log(`${LOG} ${label} Processing "${entry.title}" (gutenbergId: ${entry.gutenbergId})`);

  if (!entry.epubUrl) {
    console.log(`  → No EPUB URL — skipping`);
    return "fail";
  }

  let bookId: string | null = null;

  try {
    if (!dryRun) {
      await warnTitleAuthorOverlap(entry);
    }

    const existing = await prisma.book.findUnique({
      where: { gutenbergId: entry.gutenbergId },
    });
    if (existing) {
      console.log(`  → [SKIP] gutenbergId ${entry.gutenbergId} already in DB`);
      return "skip";
    }

    const epubRes = await fetch(entry.epubUrl, { signal: AbortSignal.timeout(120_000) });
    if (!epubRes.ok) {
      console.log(`  → EPUB download failed: ${epubRes.status} ${entry.epubUrl}`);
      return "fail";
    }
    const epubBuffer = Buffer.from(await epubRes.arrayBuffer());
    console.log(`  → EPUB downloaded (${Math.round(epubBuffer.length / 1024)} KB)`);

    if (epubBuffer.length > MAX_EPUB_BYTES) {
      console.log(`  → EPUB exceeds 4.5MB — skipping`);
      return "fail";
    }

    bookId = randomUUID();
    const coverImageUrl = await resolveCoverUrl(bookId, entry, dryRun);
    if (coverImageUrl) {
      console.log(`  → Cover uploaded to Cloudinary`);
    } else if (!dryRun) {
      console.log(`  → No cover available`);
    }

    if (dryRun) {
      console.log(`  → Would create Book record: ${bookId}`);
    } else {
      await prisma.book.create({
        data: {
          id: bookId,
          title: entry.title,
          author: entry.authorDisplay,
          ownerId: adminUserId,
          status: BookStatus.processing,
          isPublicDomain: true,
          gutenbergId: entry.gutenbergId,
          coverImageUrl,
          description: null,
          publishedYear: null,
          openLibraryKey: null,
        },
      });
      console.log(`  → Book record created: ${bookId}`);
    }

    const { chapters, chunks, genre } = await runIngestPipeline(bookId, epubBuffer, dryRun);
    if (!dryRun) {
      console.log(`  → ${chapters} chapters parsed, ${chunks} chunks created`);
      console.log(`  → Genre: ${genre}`);
      await enrichOpenLibrary(bookId, dryRun);
      console.log(`  → Status: pending_review`);
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  ✓ Done (${elapsed}s)`);
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("SKIP-GENRE")) {
      console.log(`  → [SKIP-GENRE] "${entry.title}" — genre classification failed; left as draft`);
      return "skip-genre";
    }
    console.log(`  → FAILED: ${msg}`);
    if (bookId && !dryRun) {
      await rollbackBook(bookId, dryRun);
      console.log(`  → Book record rolled back`);
    }
    return "fail";
  }
}

async function main(): Promise<void> {
  const { dryRun, resume, limit } = parseArgs();

  const required = ["DATABASE_URL", "OPENAI_API_KEY", "CLOUDINARY_URL", "GUTENBERG_ADMIN_USER_ID"] as const;
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`${LOG} Missing env: ${key}`);
      process.exit(1);
    }
  }

  const queuePath = path.resolve(process.cwd(), QUEUE_PATH);
  if (!fs.existsSync(queuePath)) {
    console.error(`${LOG} Queue file not found: ${QUEUE_PATH}`);
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8")) as GutenbergQueueFile;
  let approved = queue.entries.filter((e) => e.approved === true);
  if (approved.length === 0) {
    console.error(`${LOG} No approved entries in queue. Review books in /admin/gutenberg-import first.`);
    process.exit(1);
  }

  if (resume) {
    const existing = await prisma.book.findMany({
      where: { gutenbergId: { in: approved.map((e) => e.gutenbergId) } },
      select: { gutenbergId: true },
    });
    const done = new Set(existing.map((r) => r.gutenbergId).filter((id): id is number => id !== null));
    approved = approved.filter((e) => !done.has(e.gutenbergId));
    console.log(`${LOG} Resume: ${done.size} already ingested, ${approved.length} remaining`);
  }

  if (limit) {
    approved = approved.slice(0, limit);
  }

  const adminUserId = process.env.GUTENBERG_ADMIN_USER_ID!;
  const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!adminUser || adminUser.role !== UserRole.admin) {
    console.error(`${LOG} GUTENBERG_ADMIN_USER_ID must be a valid admin User.id`);
    process.exit(1);
  }

  console.log(`${LOG} Starting ingestion`);
  console.log(`  Admin user ID: ${adminUserId}`);
  console.log(`  Approved books: ${approved.length}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Limit: ${limit ?? "none"}`);
  console.log(`  Resume: ${resume}`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let skipGenre = 0;
  const failedIds: number[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (let i = 0; i < approved.length; i++) {
    const entry = approved[i]!;
    const result = await processEntry(entry, i + 1, approved.length, adminUserId, dryRun);

    if (result === "ok") {
      succeeded += 1;
      if (!dryRun) {
        const qEntry = queue.entries.find((e) => e.gutenbergId === entry.gutenbergId);
        if (qEntry) qEntry.ingestedAt = new Date().toISOString();
      }
    } else if (result === "skip") {
      skipped += 1;
    } else if (result === "skip-genre") {
      skipGenre += 1;
    } else {
      failed += 1;
      failedIds.push(entry.gutenbergId);
    }

    if (i < approved.length - 1) {
      await sleep(dryRun ? DRY_RUN_THROTTLE_MS : THROTTLE_MS);
    }
  }

  if (!dryRun) {
    queue.fetchedAt = queue.fetchedAt;
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
  }

  const genreCost =
    (totalPromptTokens / 1_000_000) * OPENAI_GPT4O_MINI_USD_PER_M_INPUT +
    (totalCompletionTokens / 1_000_000) * OPENAI_GPT4O_MINI_USD_PER_M_OUTPUT;

  console.log(`\n${LOG} Ingestion complete.`);
  console.log(`  Processed:  ${approved.length}`);
  console.log(`  Succeeded:  ${succeeded}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Skipped:    ${skipped} (dedup)`);
  console.log(`  Skip genre: ${skipGenre}`);
  if (failedIds.length > 0) {
    console.log(`  Failed gutenbergIds: ${failedIds.join(", ")}`);
  }
  if (succeeded > 0) {
    console.log(`  Estimated genre cost (if tracked): ~$${genreCost.toFixed(4)}`);
    console.log(`  (Embedding cost scales with chunk count — see ${OPENAI_EMBEDDING_USD_PER_M}/M tokens)`);
  }
}

main()
  .catch((err) => {
    console.error(`${LOG} Fatal:`, err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
