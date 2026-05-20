/**
 * Move blocked titles out of the active discovery queue into gutenberg-queue-deferred.json
 * so bulk ingest --resume does not retry them every run.
 *
 * Usage:
 *   npm run gutenberg-park-deferred              # no EPUB + too-large flags
 *   npm run gutenberg-park-deferred -- --no-epub
 *   npm run gutenberg-park-deferred -- --too-large
 */
import "./lib/load-env";
import fs from "node:fs";
import path from "node:path";
import { QUEUE_PATH } from "./lib/gutenberg-filters";
import {
  parkQueueEntry,
  readDeferredFile,
  writeQueueAndDeferred,
} from "./lib/gutenberg-deferred";
import {
  INGEST_DEFER_NO_EPUB,
  INGEST_SKIP_EPUB_TOO_LARGE,
  shouldSkipAutoIngest,
  type GutenbergQueueFile,
} from "./lib/gutenberg-types";

const LOG = "[gutenberg-park-deferred]";

function parseModes(): { noEpub: boolean; tooLarge: boolean } {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    return { noEpub: true, tooLarge: true };
  }
  return {
    noEpub: argv.includes("--no-epub") || argv.includes("--all"),
    tooLarge: argv.includes("--too-large") || argv.includes("--all"),
  };
}

async function main(): Promise<void> {
  const { noEpub, tooLarge } = parseModes();
  if (!noEpub && !tooLarge) {
    console.error(`${LOG} Pass --no-epub, --too-large, or no flags (both).`);
    process.exit(1);
  }

  const queuePath = path.resolve(process.cwd(), QUEUE_PATH);
  if (!fs.existsSync(queuePath)) {
    console.error(`${LOG} Queue not found: ${QUEUE_PATH}`);
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8")) as GutenbergQueueFile;
  const deferred = readDeferredFile();

  let parkedNoEpub = 0;
  let parkedTooLarge = 0;

  if (noEpub) {
    const targets = queue.entries.filter((e) => e.approved === true && !e.epubUrl);
    for (const entry of targets) {
      if (parkQueueEntry(queue, deferred, entry.gutenbergId, INGEST_DEFER_NO_EPUB)) {
        parkedNoEpub += 1;
        console.log(`${LOG} Parked (no EPUB): ${entry.gutenbergId} — ${entry.title}`);
      }
    }
  }

  if (tooLarge) {
    const targets = queue.entries.filter((e) => shouldSkipAutoIngest(e));
    for (const entry of targets) {
      if (parkQueueEntry(queue, deferred, entry.gutenbergId, INGEST_SKIP_EPUB_TOO_LARGE)) {
        parkedTooLarge += 1;
        console.log(`${LOG} Parked (too large): ${entry.gutenbergId} — ${entry.title}`);
      }
    }
  }

  writeQueueAndDeferred(queue, deferred);

  console.log(`\n${LOG} Done.`);
  console.log(`  Parked (no EPUB):   ${parkedNoEpub}`);
  console.log(`  Parked (too large): ${parkedTooLarge}`);
  console.log(`  Active queue:       ${queue.entries.length} entries`);
  console.log(`  Deferred queue:     ${deferred.entries.length} entries`);
  console.log(`  File: scripts/gutenberg-queue-deferred.json`);
}

main().catch((err) => {
  console.error(`${LOG} Fatal:`, err);
  process.exit(1);
});
