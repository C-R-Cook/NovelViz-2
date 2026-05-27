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
 *   npm run gutenberg-enrich -- --gutenberg-summaries --status pending_review
 *   npm run gutenberg-enrich -- --gutenberg-summaries --dry-run --limit 10
 *
 * For PG descriptions, prefer resolveGutenbergCatalogDescription (see lib/gutenberg-page-summary.ts).
 */
import "./lib/load-env";
import {
  descriptionFromGutenbergSummary,
  fetchGutendexBooksByIds,
  isDescriptionEligibleForGutenbergSummaryBackfill,
  PG_IN_PUBLISHED_ORDER_PREFIX,
  PG_SUBJECT_FALLBACK_PREFIX,
} from "@/lib/book-description";
import {
  GUTENBERG_SCRAPE_DELAY_MS,
  resolveGutenbergCatalogDescription,
} from "@/lib/gutenberg-page-summary";
import { resolveMissingBookDescription } from "@/lib/book-description-resolve";
import { resolveGutenbergBookEnrichment } from "@/lib/open-library-cover";
import { PrismaNeon } from "@prisma/adapter-neon";
import { BookStatus, Prisma, PrismaClient } from "@db";

const LOG = "[gutenberg-enrich]";
const THROTTLE_MS = 1000;
const SUMMARY_BATCH_THROTTLE_MS = 400;
const GUTENDEX_BATCH_SIZE = 32;

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
  const gutenbergSummaries = process.argv.includes("--gutenberg-summaries");
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
    gutenbergSummaries,
    noEpubDownload,
    limit: Number.isFinite(limit) && limit! > 0 ? limit! : null,
    statusFilter: gutenbergSummaries && !statusFilter ? BookStatus.pending_review : statusFilter,
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

    const skipCover = book.gutenbergId != null;
    if (skipCover && coversOnly) {
      console.log(`  → Skipping cover refresh for Gutenberg catalogue book (use admin AI cover)`);
      return "unchanged";
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
      skipCover,
      log: (msg) => console.log(`  → ${msg}`),
    });

    if (!enrichment.openLibraryKey) {
      console.log(`  → No Open Library match`);
      return "no-match";
    }

    const nextCoverUrl = skipCover ? book.coverImageUrl : enrichment.coverImageUrl;

    const coverChanged =
      !skipCover &&
      enrichment.coverImageUrl &&
      enrichment.coverImageUrl !== (book.coverImageUrl?.trim() || null);
    const metaChanged =
      enrichment.openLibraryKey !== null &&
      (enrichment.description !== book.description ||
        enrichment.publishedYear !== book.publishedYear ||
        !book.description?.trim());

    if (coversOnly && !coverChanged) {
      if (skipCover) {
        console.log(`  → Cover unchanged`);
      } else if (!enrichment.coverImageUrl) {
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
        coverImageUrl: nextCoverUrl,
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

function gutenbergSummaryBackfillWhere(): Prisma.BookWhereInput {
  return {
    OR: [
      { description: null },
      { description: "" },
      {
        description: {
          startsWith: PG_IN_PUBLISHED_ORDER_PREFIX,
          mode: "insensitive",
        },
      },
      { description: { startsWith: PG_SUBJECT_FALLBACK_PREFIX } },
      /** Header search chrome (X + Go!) wrongly stored as description */
      {
        AND: [
          { description: { contains: "Go!" } },
          {
            OR: [
              { description: { startsWith: "X" } },
              { description: { startsWith: "x" } },
            ],
          },
        ],
      },
    ],
  };
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function backfillGutenbergSummaries(
  books: BookRow[],
  dryRun: boolean,
): Promise<{ updated: number; skipped: number; errors: number }> {
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const withId = books.filter((b): b is BookRow & { gutenbergId: number } => b.gutenbergId != null);
  const batches = chunkIds(withId, GUTENDEX_BATCH_SIZE);

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;
    const ids = batch.map((b) => b.gutenbergId);
    console.log(
      `${LOG} Batch ${bi + 1}/${batches.length}: Gutendex lookup for ${ids.length} ids`,
    );

    const gutendexById = await fetchGutendexBooksByIds(ids);

    for (const book of batch) {
      try {
        if (!isDescriptionEligibleForGutenbergSummaryBackfill(book.description)) {
          console.log(`  ○ "${book.title}" — description not eligible for backfill`);
          skipped += 1;
          continue;
        }

        const snapshot = gutendexById.get(book.gutenbergId);
        const hadGutendex = Boolean(descriptionFromGutenbergSummary(snapshot?.summaries));
        const summary = await resolveGutenbergCatalogDescription(
          book.gutenbergId,
          snapshot?.summaries,
          { corruptedDescription: book.description },
        );
        if (!hadGutendex) {
          await sleep(GUTENBERG_SCRAPE_DELAY_MS);
        }

        if (!summary) {
          console.log(`  ○ "${book.title}" — no Gutendex or gutenberg.org summary`);
          skipped += 1;
          continue;
        }

        const prev = book.description?.trim() || null;
        if (prev === summary) {
          console.log(`  ○ "${book.title}" — already set (${summary.length} chars)`);
          skipped += 1;
          continue;
        }

        if (dryRun) {
          console.log(
            `  → Would set description (${summary.length} chars) for "${book.title}"` +
              (prev ? `, replacing ${prev.length} chars` : ""),
          );
          updated += 1;
          continue;
        }

        await prisma.book.update({
          where: { id: book.id },
          data: { description: summary },
        });
        console.log(
          `  ✓ "${book.title}" — description updated (${summary.length} chars)` +
            (prev ? `, was ${prev.length} chars` : ""),
        );
        updated += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ✗ "${book.title}" — ${msg}`);
        errors += 1;
      }
    }

    if (bi < batches.length - 1) await sleep(SUMMARY_BATCH_THROTTLE_MS);
  }

  return { updated, skipped, errors };
}

async function main(): Promise<void> {
  const {
    dryRun,
    refreshCovers,
    missingDescriptions,
    gutenbergSummaries,
    noEpubDownload,
    limit,
    statusFilter,
  } = parseArgs();

  const modeCount = [refreshCovers, missingDescriptions, gutenbergSummaries].filter(Boolean).length;
  if (modeCount > 1) {
    console.error(
      `${LOG} Use only one of: --refresh-covers, --missing-descriptions, --gutenberg-summaries`,
    );
    process.exit(1);
  }

  if (!dryRun && !missingDescriptions && !gutenbergSummaries && !process.env.CLOUDINARY_URL) {
    console.error(`${LOG} CLOUDINARY_URL is required when uploading covers.`);
    process.exit(1);
  }

  let where: Prisma.BookWhereInput;
  if (gutenbergSummaries) {
    where = {
      deletedAt: null,
      gutenbergId: { not: null },
      ...gutenbergSummaryBackfillWhere(),
      ...(statusFilter ? { status: statusFilter } : {}),
    };
  } else if (missingDescriptions) {
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

  const modeLabel = gutenbergSummaries
    ? "Gutendex summary description backfill"
    : missingDescriptions
      ? "missing description backfill"
      : refreshCovers
        ? "cover refresh"
        : "metadata enrichment";

  console.log(`${LOG} Starting ${modeLabel}`);
  console.log(`  Books to process: ${books.length}`);
  console.log(`  Dry run: ${dryRun}`);
  if (gutenbergSummaries) {
    console.log(
      `  Only updates when description is empty, starts with "${PG_IN_PUBLISHED_ORDER_PREFIX}", starts with "${PG_SUBJECT_FALLBACK_PREFIX}", or starts with Gutenberg search chrome (X / Go!)`,
    );
    if (statusFilter) console.log(`  Status filter: ${statusFilter}`);
    console.log(`  Gutendex batch size: ${GUTENDEX_BATCH_SIZE}`);
  }
  if (missingDescriptions) {
    console.log(`  EPUB download fallback: ${noEpubDownload ? "off" : "on"}`);
    if (statusFilter) console.log(`  Status filter: ${statusFilter}`);
  }
  if (!gutenbergSummaries) {
    console.log(`  Throttle: ${THROTTLE_MS}ms between books`);
  }

  if (gutenbergSummaries) {
    const { updated, skipped, errors } = await backfillGutenbergSummaries(books, dryRun);
    console.log(`\n${LOG} Complete.`);
    console.log(`  Processed:  ${books.length}`);
    console.log(`  Updated:    ${updated}`);
    console.log(`  Skipped:    ${skipped}`);
    console.log(`  Errors:     ${errors}`);
    return;
  }

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
