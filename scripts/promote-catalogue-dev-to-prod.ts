/**
 * Promote dev_user_admin catalogue from development Neon → production Neon.
 * Copies book metadata, chapters, chunk embeddings, and Cloudinary covers to novelviz/prod/…
 *
 *   SOURCE_DATABASE_URL="..." TARGET_DATABASE_URL="..." \
 *     npx tsx scripts/promote-catalogue-dev-to-prod.ts --dry-run
 *
 *   SOURCE_DATABASE_URL="..." TARGET_DATABASE_URL="..." \
 *     npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply \
 *     --owner-id cmpgiq4wj000004k361w2uwz7
 *
 * Re-run only incomplete promotions (target chapter count < source):
 *   ... npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply --retry-failed
 *
 * Re-run specific books:
 *   ... npx tsx scripts/promote-catalogue-dev-to-prod.ts --apply --book-id <uuid>
 */
import "./lib/load-env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "@db";
import { randomUUID } from "node:crypto";
import { copyCoverToProdFolder } from "@/lib/cloudinary-copy-cover";
import { isCloudinaryHttpsUrl } from "@/lib/cloudinary";

const DEFAULT_SOURCE_OWNER = "dev_user_admin";
const DEFAULT_TARGET_OWNER = "cmpgiq4wj000004k361w2uwz7";
const CHUNK_INSERT_BATCH = 40;
const CHAPTER_INSERT_BATCH = 50;
const TX_TIMEOUT_MS = 120_000;

type ChunkRow = {
  chapterId: string;
  sequenceNumber: number;
  content: string;
  embeddingText: string;
};

type SourceBook = Prisma.BookGetPayload<{
  include: { chapters: true };
}>;

function parseArgs(argv: string[]) {
  let apply = false;
  let retryFailed = false;
  let sourceOwner = DEFAULT_SOURCE_OWNER;
  let targetOwner = DEFAULT_TARGET_OWNER;
  let sourceUrl = process.env.SOURCE_DATABASE_URL?.trim() ?? "";
  let targetUrl = process.env.TARGET_DATABASE_URL?.trim() ?? "";
  const bookIds: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg === "--retry-failed") retryFailed = true;
    else if (arg === "--source-owner" && argv[i + 1]) sourceOwner = argv[++i]!;
    else if (arg === "--owner-id" && argv[i + 1]) targetOwner = argv[++i]!;
    else if (arg === "--source-url" && argv[i + 1]) sourceUrl = argv[++i]!;
    else if (arg === "--target-url" && argv[i + 1]) targetUrl = argv[++i]!;
    else if (arg === "--book-id" && argv[i + 1]) bookIds.push(argv[++i]!);
  }

  return { apply, retryFailed, sourceOwner, targetOwner, sourceUrl, targetUrl, bookIds };
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
  });
}

function bookCopyFields(
  book: SourceBook,
  coverImageUrl: string | null,
): Omit<Prisma.BookCreateInput, "id" | "owner"> {
  return {
    title: book.title,
    author: book.author,
    coverImageUrl,
    coverIsAiGenerated: book.coverIsAiGenerated,
    description: book.description,
    genre: book.genre,
    publishedYear: book.publishedYear,
    openLibraryKey: book.openLibraryKey,
    gutenbergId: book.gutenbergId,
    isPublicDomain: book.isPublicDomain,
    status: book.status,
    rejectionReason: book.rejectionReason,
    internalNotes: book.internalNotes,
    listingPreferenceAfterReview: book.listingPreferenceAfterReview,
    scheduledPublishAt: book.scheduledPublishAt,
    ingestionPromptTokens: book.ingestionPromptTokens,
    ingestionCompletionTokens: book.ingestionCompletionTokens,
    coverGenAttemptsConsumed: book.coverGenAttemptsConsumed,
    coverGenAttemptsGranted: book.coverGenAttemptsGranted,
    featuredTargetAgeRanges: book.featuredTargetAgeRanges,
    featuredTargetGenders: book.featuredTargetGenders,
    featuredTargetCountries: book.featuredTargetCountries,
    featuredTargetGenres: book.featuredTargetGenres,
    deletedAt: null,
  };
}

async function resolveTargetBookId(
  target: PrismaClient,
  source: { id: string; gutenbergId: number | null },
): Promise<{ targetBookId: string; exists: boolean }> {
  if (source.gutenbergId != null) {
    const byGutenberg = await target.book.findUnique({
      where: { gutenbergId: source.gutenbergId },
      select: { id: true },
    });
    if (byGutenberg) {
      return { targetBookId: byGutenberg.id, exists: true };
    }
  }
  const byId = await target.book.findUnique({
    where: { id: source.id },
    select: { id: true },
  });
  if (byId) {
    return { targetBookId: byId.id, exists: true };
  }
  return { targetBookId: source.id, exists: false };
}

async function copyChunks(
  target: PrismaClient,
  targetBookId: string,
  chapterIdMap: Map<string, string>,
  rows: ChunkRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
    const batch = rows.slice(i, i + CHUNK_INSERT_BATCH);
    const valueRows = batch.map((row) => {
      const chapterId = chapterIdMap.get(row.chapterId);
      if (!chapterId) {
        throw new Error(`Missing chapter map for ${row.chapterId}`);
      }
      return Prisma.sql`(gen_random_uuid(), ${chapterId}, ${targetBookId}, ${row.sequenceNumber}, ${row.content}, ${row.embeddingText}::vector, now(), now())`;
    });
    await target.$executeRaw`
      INSERT INTO "Chunk" (id, "chapterId", "bookId", "sequenceNumber", content, embedding, "createdAt", "updatedAt")
      VALUES ${Prisma.join(valueRows, ", ")}
    `;
    inserted += batch.length;
  }
  return inserted;
}

async function targetChapterCount(
  target: PrismaClient,
  targetBookId: string,
): Promise<number> {
  return target.chapter.count({ where: { bookId: targetBookId } });
}

async function main() {
  const { apply, retryFailed, sourceOwner, targetOwner, sourceUrl, targetUrl, bookIds } =
    parseArgs(process.argv.slice(2));

  if (!sourceUrl || !targetUrl) {
    throw new Error(
      "Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL (or pass --source-url / --target-url)",
    );
  }
  if (!process.env.CLOUDINARY_URL?.trim() &&
      !(process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim())) {
    throw new Error(
      "Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (needed to copy covers to novelviz/prod/…)",
    );
  }

  const source = createPrisma(sourceUrl);
  const target = createPrisma(targetUrl);

  const targetUser = await target.user.findUnique({
    where: { id: targetOwner },
    select: { id: true, email: true },
  });
  if (!targetUser) {
    throw new Error(`Target owner not found on production DB: ${targetOwner}`);
  }

  let books = await source.book.findMany({
    where: {
      ownerId: sourceOwner,
      deletedAt: null,
      ...(bookIds.length > 0 ? { id: { in: bookIds } } : {}),
    },
    orderBy: { title: "asc" },
    include: {
      chapters: { orderBy: { sequenceNumber: "asc" } },
    },
  });

  if (retryFailed) {
    const incomplete: SourceBook[] = [];
    for (const book of books) {
      const { targetBookId } = await resolveTargetBookId(target, book);
      const onTarget = await targetChapterCount(target, targetBookId);
      if (onTarget < book.chapters.length) {
        incomplete.push(book);
      }
    }
    books = incomplete;
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Source owner: ${sourceOwner} → Target owner: ${targetUser.email} (${targetOwner})`);
  console.log(`Books to promote: ${books.length}${retryFailed ? " (retry-failed)" : ""}`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const book of books) {
    const label = `"${book.title}" (${book.id})`;
    try {
      const { targetBookId, exists } = await resolveTargetBookId(target, book);
      const chapters = book.chapters;
      const chunkRows = await source.$queryRaw<ChunkRow[]>`
        SELECT "chapterId", "sequenceNumber", content, embedding::text as "embeddingText"
        FROM "Chunk"
        WHERE "bookId" = ${book.id}
        ORDER BY "chapterId", "sequenceNumber"
      `;

      let coverUrl = book.coverImageUrl;
      if (coverUrl && isCloudinaryHttpsUrl(coverUrl)) {
        if (apply) {
          coverUrl = await copyCoverToProdFolder({
            sourceUrl: coverUrl,
            bookId: targetBookId,
            coverIsAiGenerated: book.coverIsAiGenerated,
          });
        } else {
          console.log(
            `  ${label}: would copy cover → novelviz/prod/covers/${book.coverIsAiGenerated ? "ai" : "user"}/${targetBookId}`,
          );
        }
      } else if (coverUrl && !isCloudinaryHttpsUrl(coverUrl)) {
        console.log(`  ${label}: non-Cloudinary cover kept as-is`);
      }

      console.log(
        `  ${label}: ${exists ? "update" : "create"} on prod as ${targetBookId} | ${chapters.length} chapters, ${chunkRows.length} chunks, status=${book.status}`,
      );

      if (!apply) {
        if (exists) updated += 1;
        else created += 1;
        continue;
      }

      const chapterIdMap = new Map<string, string>();

      await target.$transaction(
        async (tx) => {
          await tx.readingProgress.deleteMany({ where: { bookId: targetBookId } });
          await tx.chapter.deleteMany({ where: { bookId: targetBookId } });

          const fields = bookCopyFields(book, coverUrl);
          if (exists) {
            await tx.book.update({
              where: { id: targetBookId },
              data: {
                ...fields,
                owner: { connect: { id: targetOwner } },
              },
            });
          } else {
            await tx.book.create({
              data: {
                id: targetBookId,
                ...fields,
                owner: { connect: { id: targetOwner } },
              },
            });
          }

          for (let i = 0; i < chapters.length; i += CHAPTER_INSERT_BATCH) {
            const batch = chapters.slice(i, i + CHAPTER_INSERT_BATCH);
            await tx.chapter.createMany({
              data: batch.map((ch) => {
                const newChapterId = randomUUID();
                chapterIdMap.set(ch.id, newChapterId);
                return {
                  id: newChapterId,
                  bookId: targetBookId,
                  sequenceNumber: ch.sequenceNumber,
                  title: ch.title,
                  rawText: ch.rawText,
                };
              }),
            });
          }

          await copyChunks(tx as unknown as PrismaClient, targetBookId, chapterIdMap, chunkRows);
        },
        { maxWait: TX_TIMEOUT_MS, timeout: TX_TIMEOUT_MS },
      );

      if (exists) updated += 1;
      else created += 1;
    } catch (e) {
      errors += 1;
      console.error(`  ✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log("");
  console.log(`Done. created=${created} updated=${updated} errors=${errors}`);

  await source.$disconnect();
  await target.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
