-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'standard', 'premium');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'past_due', 'trialing');

-- CreateEnum
CREATE TYPE "GrantType" AS ENUM ('TIER_UPGRADE', 'QUERY_BONUS', 'IMAGE_BONUS');

-- CreateEnum
CREATE TYPE "GrantSource" AS ENUM ('ADMIN', 'SYSTEM', 'PURCHASE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'standard',
ADD COLUMN     "usagePeriodAnchor" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "UserGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantType" "GrantType" NOT NULL,
    "source" "GrantSource" NOT NULL DEFAULT 'ADMIN',
    "tierValue" "SubscriptionTier",
    "bonusAmount" INTEGER,
    "usedAmount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "grantedBy" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGrant_userId_idx" ON "UserGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeKey_key" ON "UserBadge"("userId", "badgeKey");

-- AddForeignKey
ALTER TABLE "UserGrant" ADD CONSTRAINT "UserGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
