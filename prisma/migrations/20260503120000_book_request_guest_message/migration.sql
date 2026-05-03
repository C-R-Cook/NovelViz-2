-- AlterTable
ALTER TABLE "BookRequest" ADD COLUMN "message" TEXT;

-- AlterTable
ALTER TABLE "BookRequest" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BookRequest_bookTitle_idx" ON "BookRequest"("bookTitle");
