-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "ModerationLogSource" AS ENUM ('auto', 'admin', 'user_flag', 'system');

-- CreateEnum
CREATE TYPE "ModerationAppealStatus" AS ENUM ('pending', 'approved', 'denied');

-- AlterEnum
ALTER TYPE "CreditTransactionReason" ADD VALUE 'FORFEITED_TERMINATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "terminatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "statusReason" TEXT;

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ModerationLogSource" NOT NULL,
    "aupCategory" TEXT,
    "commentId" TEXT,
    "queryId" TEXT,
    "imageId" TEXT,
    "summary" TEXT,
    "createdBy" TEXT,
    "flaggedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ModerationAppealStatus" NOT NULL DEFAULT 'pending',
    "userMessage" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_userId_createdAt_idx" ON "ModerationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_flaggedByUserId_idx" ON "ModerationLog"("flaggedByUserId");

-- CreateIndex
CREATE INDEX "ModerationAppeal_userId_status_idx" ON "ModerationAppeal"("userId", "status");

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_flaggedByUserId_fkey" FOREIGN KEY ("flaggedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
