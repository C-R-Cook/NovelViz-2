-- CreateEnum
CREATE TYPE "CreditTransactionReason" AS ENUM ('PURCHASE', 'SPEND_QUERY', 'SPEND_IMAGE', 'ADMIN_ADJUST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "usagePeriodStart" TIMESTAMP(3);

ALTER TABLE "User" ALTER COLUMN "subscriptionTier" SET DEFAULT 'free';

-- CreateTable
CREATE TABLE "TierLimitConfig" (
    "tier" "SubscriptionTier" NOT NULL,
    "queriesPerMonth" INTEGER,
    "imagesPerMonth" INTEGER,
    "allowedModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditPurchasesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "creditCostQuery" INTEGER NOT NULL DEFAULT 1,
    "creditCostImage" INTEGER NOT NULL DEFAULT 3,
    "displayPriceMonthly" TEXT,
    "stripePriceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TierLimitConfig_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "CreditPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceFree" INTEGER NOT NULL DEFAULT 0,
    "priceStandard" INTEGER NOT NULL DEFAULT 0,
    "pricePremium" INTEGER NOT NULL DEFAULT 0,
    "stripePriceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditTransactionReason" NOT NULL,
    "bookId" TEXT,
    "creditPackId" TEXT,
    "stripePaymentIntentId" TEXT,
    "grantedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuotaOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queriesLimit" INTEGER,
    "imagesLimit" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuotaOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiServiceFailure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "bookId" TEXT,
    "errorSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiServiceFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_bookId_idx" ON "CreditTransaction"("bookId");

-- CreateIndex
CREATE INDEX "UserQuotaOverride_userId_idx" ON "UserQuotaOverride"("userId");

-- CreateIndex
CREATE INDEX "AiServiceFailure_createdAt_idx" ON "AiServiceFailure"("createdAt");

-- CreateIndex
CREATE INDEX "AiServiceFailure_userId_idx" ON "AiServiceFailure"("userId");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_creditPackId_fkey" FOREIGN KEY ("creditPackId") REFERENCES "CreditPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuotaOverride" ADD CONSTRAINT "UserQuotaOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceFailure" ADD CONSTRAINT "AiServiceFailure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed tier limits from plan-picker placeholder values
INSERT INTO "TierLimitConfig" (
    "tier",
    "queriesPerMonth",
    "imagesPerMonth",
    "allowedModels",
    "creditPurchasesEnabled",
    "creditCostQuery",
    "creditCostImage",
    "displayPriceMonthly",
    "updatedAt"
) VALUES
(
    'free',
    50,
    5,
    ARRAY['xai/grok-imagine-image']::TEXT[],
    false,
    1,
    3,
    'Free',
    CURRENT_TIMESTAMP
),
(
    'standard',
    NULL,
    50,
    ARRAY['xai/grok-imagine-image']::TEXT[],
    true,
    1,
    3,
    '$5/mo',
    CURRENT_TIMESTAMP
),
(
    'premium',
    NULL,
    120,
    ARRAY['xai/grok-imagine-image', 'fal-ai/bytedance/seedream/v4.5/text-to-image']::TEXT[],
    true,
    1,
    3,
    '$10/mo',
    CURRENT_TIMESTAMP
);
