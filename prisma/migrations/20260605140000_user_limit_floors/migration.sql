-- AlterTable
ALTER TABLE "User" ADD COLUMN "queriesLimitFloor" INTEGER,
ADD COLUMN "imagesLimitFloor" INTEGER,
ADD COLUMN "queriesUnlimitedFloor" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users with current tier limits as their floor
UPDATE "User" u
SET
  "queriesLimitFloor" = t."queriesPerMonth",
  "imagesLimitFloor" = t."imagesPerMonth",
  "queriesUnlimitedFloor" = (t."queriesPerMonth" IS NULL)
FROM "TierLimitConfig" t
WHERE t.tier = u."subscriptionTier"
  AND u."queriesLimitFloor" IS NULL
  AND u."imagesLimitFloor" IS NULL
  AND u."queriesUnlimitedFloor" = false;
