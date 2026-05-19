-- AlterTable
ALTER TABLE "Book" ADD COLUMN "gutenbergId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Book_gutenbergId_key" ON "Book"("gutenbergId");
