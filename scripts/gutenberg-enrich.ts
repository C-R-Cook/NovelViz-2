/**
 * Backfill Open Library metadata/covers for books ingested before unified ingest,
 * or refresh covers on existing Gutenberg imports.
 *
 * Usage:
 *   npm run gutenberg-enrich
 *   npm run gutenberg-enrich -- --refresh-covers
 *   npm run gutenberg-enrich -- --missing-descriptions --status pending_review
 *   npm run gutenberg-enrich -- --missing-descriptions --limit 20 --dry-run
 *   npm run gutenberg-enrich -- --missing-descriptions --no-epub-download
 */
import "./lib/load-env";
import { resolveMissingBookDescription } from "@/lib/book-description-resolve";
import { resolveGutenbergBookEnrichment } from "@/lib/open-library-cover";
import { PrismaNeon } from "@prisma/adapter-neon";
import { BookStatus, Prisma, PrismaClient } from "@db";

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
  const missingDescriptions = process.argv.includes("--missing-descriptions");
  const noEpubDownload = process.argv.includes("--no-epub-download");
  const limitIdx = process.argv.indexOf("--limit");
  const statusIdx = process.argv.indexOf("--status");
  const limit =
    limitIdx !== -1 && process.argv[limitIdx + 1]
      ? Number.parseInt(process.argv[limitIdx + 1]!, 10)
      : null;
  const statusRaw =
    statusIdx !== -1 && process.argv[statusIdx + 1] ? process.argv[statusIdx + 1]! : null;
  const statusFilter =
    statusRaw && (Object.values(BookStatus) as string[]).includes(statusRaw)
      ? (statusRaw as BookStatus)
      : null;
  return {
    dryRun,
    refreshCovers,
    missingDescriptions,
    noEpubDownload,
    limit: Number.isFinite(limit) && limit! > 0 ? limit! : null,
    statusFilter,
  };
}

type BookRow = {
  id: string;
  title: string;
  author: string;
  description: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  openLibraryKey: string | null;
  gutenbergId: number | null;
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
      existingOpenLibraryKey: book.openLibraryKey,
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

async function backfillDescription(
  book: BookRow,
  index: number,
  total: number,
  dryRun: boolean,
  tryEpubDownload: boolean,
): Promise<"enriched" | "no-match" | "unchanged" | "error"> {
  const label = `[${index}/${total}]`;
  console.log(`${LOG} ${label} "${book.title}" — ${book.author}`);

  if (book.description?.trim()) {
    console.log(`  → Already has description — skipped`);
    return "unchanged";
  }

  try {
    if (dryRun) {
      console.log(`  → Would resolve description (OL key → search → EPUB → subjects)`);
      return "enriched";
    }

    const resolved = await resolveMissingBookDescription({
      title: book.title,
      author: book.author,
      openLibraryKey: book.openLibraryKey,
      gutenbergId: book.gutenbergId,
      tryEpubDownload,
      log: (msg) => console.log(`  → ${msg}`),
    });

    if (!resolved.description) {
      console.log(`  → No description found (${resolved.sources.join(", ") || "no sources"})`);
      return "no-match";
    }

    const data: Prisma.BookUpdateInput = {
      description: resolved.description,
    };
    if (resolved.openLibraryKey && !book.openLibraryKey) {
      data.openLibraryKey = resolved.openLibraryKey;
    }
    if (resolved.publishedYear && !book.publishedYear) {
      data.publishedYear = resolved.publishedYear;
    }

    await prisma.book.update({ where: { id: book.id }, data });

    console.log(`  ✓ Description (${resolved.description.length} chars) via ${resolved.sources.join(", ")}`);
    return "enriched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ Error: ${msg}`);
    return "error";
  }
}

function emptyDescriptionWhere(): Prisma.BookWhereInput {
  return {
    OR: [{ description: null }, { description: "" }],
  };
}

async function main(): Promise<void> {
  const { dryRun, refreshCovers, missingDescriptions, noEpubDownload, limit, statusFilter } =
    parseArgs();

  if (refreshCovers && missingDescriptions) {
    console.error(`${LOG} Use either --refresh-covers or --missing-descriptions, not both.`);
    process.exit(1);
  }

  if (!dryRun && !missingDescriptions && !process.env.CLOUDINARY_URL) {
    console.error(`${LOG} CLOUDINARY_URL is required when uploading covers.`);
    process.exit(1);
  }

  let where: Prisma.BookWhereInput;
  if (missingDescriptions) {
    where = {
      deletedAt: null,
      ...emptyDescriptionWhere(),
      ...(statusFilter ? { status: statusFilter } : {}),
    };
  } else if (refreshCovers) {
    where = { openLibraryKey: { not: null }, gutenbergId: { not: null }, deletedAt: null };
  } else {
    where = { openLibraryKey: null, deletedAt: null };
  }

  let books = await prisma.book.findMany({
    where,
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      publishedYear: true,
      coverImageUrl: true,
      openLibraryKey: true,
      gutenbergId: true,
    },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });

  if (limit) {
    books = books.slice(0, limit);
  }

  const modeLabel = missingDescriptions
    ? "missing description backfill"
    : refreshCovers
      ? "cover refresh"
      : "metadata enrichment";

  console.log(`${LOG} Starting ${modeLabel}`);
  console.log(`  Books to process: ${books.length}`);
  console.log(`  Dry run: ${dryRun}`);
  if (missingDescriptions) {
    console.log(`  EPUB download fallback: ${noEpubDownload ? "off" : "on"}`);
    if (statusFilter) console.log(`  Status filter: ${statusFilter}`);
  }
  console.log(`  Throttle: ${THROTTLE_MS}ms between books`);

  let enriched = 0;
  let unchanged = 0;
  let noMatch = 0;
  let errors = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i]!;
    const result = missingDescriptions
      ? await backfillDescription(book, i + 1, books.length, dryRun, !noEpubDownload)
      : await enrichBook(book, i + 1, books.length, dryRun, refreshCovers);
    if (result === "enriched") enriched += 1;
    else if (result === "unchanged") unchanged += 1;
    else if (result === "no-match") noMatch += 1;
    else errors += 1;

    if (i < books.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n${LOG} Complete.`);
  console.log(`  Processed:  ${books.length}`);
  console.log(`  Enriched:   ${enriched}`);
  if (refreshCovers || missingDescriptions) console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  No match:   ${noMatch}`);
  console.log(`  Errors:     ${errors}`);

  if (missingDescriptions) {
    const remaining = await prisma.book.count({
      where: {
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...emptyDescriptionWhere(),
      },
    });
    console.log(`  Remaining (empty description${statusFilter ? `, status=${statusFilter}` : ""}): ${remaining}`);
  } else if (!refreshCovers) {
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
