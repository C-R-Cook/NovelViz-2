-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "PartnerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "roleOrTitle" TEXT,
    "websiteUrl" TEXT,
    "catalogSummary" TEXT NOT NULL,
    "genresPublished" TEXT NOT NULL,
    "audienceReach" TEXT,
    "motivation" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "status" "PartnerApplicationStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerApplication_userId_idx" ON "PartnerApplication"("userId");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_idx" ON "PartnerApplication"("status");

-- AddForeignKey
ALTER TABLE "PartnerApplication" ADD CONSTRAINT "PartnerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
