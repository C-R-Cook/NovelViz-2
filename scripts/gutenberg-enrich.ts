/**
 * Backfill Open Library metadata/covers for books ingested before unified ingest,
 * or refresh covers on existing Gutenberg imports.
 *
 * Normal ingest already runs Gutenberg EPUB / Gutendex covers + Open Library metadata — you usually
 * do not need this unless repairing older rows.
 *
 * Usage:
 *   npm run gutenberg-enrich
 *   npm run gutenberg-enrich -- --refresh-covers
 *   npm run gutenberg-enrich -- --limit 10 --dry-run
 */
import "./lib/load-env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@db";
import { resolveGutenbergBookEnrichment } from "@/lib/open-library-cover";

const LOG = "[gutenberg-enrich]";
const THROTTLE_MS = 1000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const refreshCovers = process.argv.includes("--refresh-covers");
  const limitIdx = process.argv.indexOf("--limit");
  const limit =
    limitIdx !== -1 && process.argv[limitIdx + 1]
      ? Number.parseInt(process.argv[limitIdx + 1]!, 10)
      : null;
  return { dryRun, refreshCovers, limit: Number.isFinite(limit) && limit! > 0 ? limit! : null };
}

type BookRow = {
  id: string;
  title: string;
  author: string;
  description: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
};

async function enrichBook(
  book: BookRow,
  index: number,
  total: number,
  dryRun: boolean,
  coversOnly: boolean,
): Promise<"enriched" | "no-match" | "unchanged" | "error"> {
  const label = `[${index}/${total}]`;
  console.log(`${LOG} ${label} "${book.title}" — ${book.author}`);

  try {
    if (dryRun) {
      console.log(
        coversOnly
          ? `  → Would refresh cover from Open Library`
          : `  → Would enrich metadata + cover from Open Library`,
      );
      return "enriched";
    }

    const enrichment = await resolveGutenbergBookEnrichment({
      bookId: book.id,
      title: book.title,
      author: book.author,
      existingDescription: book.description,
      existingPublishedYear: book.publishedYear,
      existingCoverUrl: book.coverImageUrl,
      preferOpenLibraryCover: coversOnly,
      log: (msg) => console.log(`  → ${msg}`),
    });

    if (!enrichment.openLibraryKey) {
      console.log(`  → No Open Library match`);
      return "no-match";
    }

    const coverChanged =
      enrichment.coverImageUrl &&
      enrichment.coverImageUrl !== (book.coverImageUrl?.trim() || null);
    const metaChanged =
      enrichment.openLibraryKey !== null &&
      (enrichment.description !== book.description ||
        enrichment.publishedYear !== book.publishedYear ||
        !book.description?.trim());

    if (coversOnly && !coverChanged) {
      if (!enrichment.coverImageUrl) {
        console.log(`  → Open Library has no cover art — skipped`);
      } else {
        console.log(`  → Cover unchanged`);
      }
      return "unchanged";
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        openLibraryKey: enrichment.openLibraryKey,
        description: enrichment.description,
        publishedYear: enrichment.publishedYear,
        coverImageUrl: enrichment.coverImageUrl,
      },
    });

    const parts = [`key=${enrichment.openLibraryKey}`];
    if (metaChanged && enrichment.description) parts.push("description");
    if (metaChanged && enrichment.publishedYear) parts.push(`year=${enrichment.publishedYear}`);
    if (coverChanged) parts.push("cover");
    console.log(`  ✓ Updated: ${parts.join(", ")}`);
    return "enriched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ Error: ${msg}`);
    return "error";
  }
}

async function main(): Promise<void> {
  const { dryRun, refreshCovers, limit } = parseArgs();

  if (!dryRun && !process.env.CLOUDINARY_URL) {
    console.error(`${LOG} CLOUDINARY_URL is required when uploading covers.`);
    process.exit(1);
  }

  const where = refreshCovers
    ? { openLibraryKey: { not: null }, gutenbergId: { not: null }, deletedAt: null }
    : { openLibraryKey: null, deletedAt: null };

  let books = await prisma.book.findMany({
    where,
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      publishedYear: true,
      coverImageUrl: true,
    },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });

  if (limit) {
    books = books.slice(0, limit);
  }

  console.log(`${LOG} Starting ${refreshCovers ? "cover refresh" : "metadata enrichment"}`);
  console.log(`  Books to process: ${books.length}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Throttle: ${THROTTLE_MS}ms between books`);

  let enriched = 0;
  let unchanged = 0;
  let noMatch = 0;
  let errors = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i]!;
    const result = await enrichBook(book, i + 1, books.length, dryRun, refreshCovers);
    if (result === "enriched") enriched += 1;
    else if (result === "unchanged") unchanged += 1;
    else if (result === "no-match") noMatch += 1;
    else errors += 1;

    if (i < books.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n${LOG} Complete.`);
  console.log(`  Processed:  ${books.length}`);
  console.log(`  Enriched:   ${enriched}`);
  if (refreshCovers) console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  No match:   ${noMatch}`);
  console.log(`  Errors:     ${errors}`);

  if (!refreshCovers) {
    const remaining = await prisma.book.count({
      where: { openLibraryKey: null, deletedAt: null },
    });
    console.log(`  Remaining (openLibraryKey still null): ${remaining}`);
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
