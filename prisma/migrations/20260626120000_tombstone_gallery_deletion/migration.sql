-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSystemUser" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN "deidentifiedAt" TIMESTAMP(3),
ADD COLUMN "formerUsername" TEXT;

-- CreateIndex
CREATE INDEX "GeneratedImage_deidentifiedAt_idx" ON "GeneratedImage"("deidentifiedAt");
