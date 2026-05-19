import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@db";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const connectionString = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  console.log("Deleting content...");

  await prisma.notification.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.featureRequest.deleteMany({});
  await prisma.generatedImage.deleteMany({});
  await prisma.query.deleteMany({});
  // ReadingProgress.currentChapter uses onDelete: Restrict — clear before chapters.
  await prisma.readingProgress.deleteMany({});
  await prisma.userBook.deleteMany({});
  await prisma.chunk.deleteMany({});
  await prisma.chapter.deleteMany({});
  await prisma.bookRequest.deleteMany({});
  await prisma.book.deleteMany({});

  console.log("Done. Users and partner records were kept.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
