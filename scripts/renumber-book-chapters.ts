/**
 * One-off: renumber chapters to 1…n for a book (creation order).
 *
 * Usage: npx tsx scripts/renumber-book-chapters.ts <bookId>
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const bookId = process.argv[2]?.trim();
  if (!bookId) {
    console.error("Usage: npx tsx scripts/renumber-book-chapters.ts <bookId>");
    process.exit(1);
  }

  const { renumberChapters, syncReadingProgressChapterNumbers } = await import(
    "@/lib/ingestion"
  );
  const { prisma } = await import("@/lib/prisma");

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!book) {
    console.error(`Book not found: ${bookId}`);
    process.exit(1);
  }

  const before = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
    select: { sequenceNumber: true },
  });
  console.log(`Renumbering "${book.title}" (${bookId}), ${before.length} chapters`);
  console.log(`Before: ${before.map((c) => c.sequenceNumber).join(", ")}`);

  await renumberChapters(bookId);
  await syncReadingProgressChapterNumbers(bookId);

  const after = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { sequenceNumber: "asc" },
    select: { sequenceNumber: true },
  });
  console.log(`After: ${after.map((c) => c.sequenceNumber).join(", ")}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
