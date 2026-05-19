import "./lib/load-env";
import fs from "node:fs";
import path from "node:path";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@db";
import {
  classifyBook,
  formatAuthorDisplay,
  pickEpubUrl,
  QUEUE_PATH,
} from "./lib/gutenberg-filters";
import {
  defaultQueueIngestFlags,
  type GutendexBook,
  type GutendexResponse,
  type GutenbergQueueFile,
  type QueueEntry,
} from "./lib/gutenberg-types";

const LOG = "[gutenberg-fetch]";
const TARGET_COUNT = 1000;
const PAGE_DELAY_MS = 300;
const GUTENDEX_BASE = "https://gutendex.com/books?languages=en&sort=popular";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<GutendexResponse> {
  const res = await fetch(url, {
    headers: { "User-Agent": "NovelViz/1.0 (gutenberg-fetch)" },
  });
  if (!res.ok) {
    throw new Error(`Gutendex request failed: ${res.status} ${url}`);
  }
  return res.json() as Promise<GutendexResponse>;
}

function toQueueEntry(book: GutendexBook): QueueEntry {
  const authorRaw = book.authors[0]?.name ?? "Unknown";
  const { filterResult, rejectReason, reviewReasons } = classifyBook(
    book.subjects,
    book.bookshelves,
  );
  return {
    gutenbergId: book.id,
    title: book.title,
    authorDisplay: formatAuthorDisplay(authorRaw),
    authorRaw,
    subjects: book.subjects,
    bookshelves: book.bookshelves,
    gutendexCoverUrl: book.formats["image/jpeg"] ?? null,
    epubUrl: pickEpubUrl(book.formats, book.id),
    downloadCount: book.download_count,
    filterResult,
    rejectReason,
    reviewReasons,
    approved: null,
    ingestedAt: null,
    ...defaultQueueIngestFlags(),
  };
}

async function loadExistingGutenbergIds(): Promise<Set<number>> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  try {
    const rows = await prisma.book.findMany({
      where: { gutenbergId: { not: null } },
      select: { gutenbergId: true },
    });
    return new Set(
      rows.map((r) => r.gutenbergId).filter((id): id is number => id !== null),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const deltaMode = process.argv.includes("--delta");
  const verbose = process.argv.includes("--verbose");

  let existingIds = new Set<number>();
  if (deltaMode) {
    existingIds = await loadExistingGutenbergIds();
    console.log(`${LOG} [delta] ${existingIds.size} gutenbergIds already in catalogue`);
  }

  const collected: GutendexBook[] = [];
  let url: string | null = GUTENDEX_BASE;
  let pageNum = 0;
  let skippedDelta = 0;

  while (url && collected.length < TARGET_COUNT) {
    pageNum += 1;
    const data = await fetchPage(url);
    if (data.results.length === 0) break;

    for (const book of data.results) {
      if (collected.length >= TARGET_COUNT) break;
      if (deltaMode && existingIds.has(book.id)) {
        skippedDelta += 1;
        continue;
      }
      collected.push(book);
    }

    console.log(
      `${LOG} Page ${pageNum}: fetched ${data.results.length} books (${collected.length} total)`,
    );

    url = data.next;
    if (url && collected.length < TARGET_COUNT) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  const entries: QueueEntry[] = [];
  let totalAccepted = 0;
  let totalReview = 0;
  let totalRejected = 0;

  for (const book of collected) {
    const entry = toQueueEntry(book);
    entries.push(entry);
    if (entry.filterResult === "accepted") totalAccepted += 1;
    else if (entry.filterResult === "review") totalReview += 1;
    else totalRejected += 1;

    if (verbose) {
      if (entry.filterResult === "rejected") {
        console.log(`${LOG} REJECT "${entry.title}" — ${entry.rejectReason}`);
      } else if (entry.filterResult === "review") {
        console.log(`${LOG} REVIEW "${entry.title}" — ${entry.reviewReasons.join(", ")}`);
      }
    }
  }

  const queue: GutenbergQueueFile = {
    fetchedAt: new Date().toISOString(),
    mode: deltaMode ? "delta" : "full",
    totalFetched: collected.length,
    totalAccepted,
    totalReview,
    totalRejected,
    totalSkippedDelta: skippedDelta,
    entries,
  };

  const outPath = path.resolve(process.cwd(), QUEUE_PATH);
  fs.writeFileSync(outPath, JSON.stringify(queue, null, 2), "utf8");

  console.log(`${LOG} Done.`);
  console.log(`  Fetched:   ${collected.length}`);
  console.log(`  Accepted:  ${totalAccepted}`);
  console.log(`  Review:    ${totalReview}`);
  console.log(`  Rejected:  ${totalRejected}`);
  console.log(`  Skipped (delta): ${skippedDelta}`);
  console.log(`  Queue written to ${QUEUE_PATH}`);
}

main().catch((err) => {
  console.error(`${LOG} Fatal:`, err);
  process.exit(1);
});
