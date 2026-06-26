-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeSuspensionLogId" TEXT;

-- AlterTable
ALTER TABLE "ModerationAppeal" ADD COLUMN "moderationLogId" TEXT;

-- Backfill appeal links: prefer suspension/termination logs before the appeal was filed.
UPDATE "ModerationAppeal" AS ma
SET "moderationLogId" = (
  SELECT ml.id
  FROM "ModerationLog" AS ml
  WHERE ml."userId" = ma."userId"
    AND ml."createdAt" <= ma."createdAt"
    AND (
      ml.summary ILIKE '%suspend%'
      OR ml.summary ILIKE '%terminated%'
    )
  ORDER BY ml."createdAt" DESC
  LIMIT 1
)
WHERE ma."moderationLogId" IS NULL;

-- Fallback: nearest preceding strike for legacy appeals.
UPDATE "ModerationAppeal" AS ma
SET "moderationLogId" = (
  SELECT ml.id
  FROM "ModerationLog" AS ml
  WHERE ml."userId" = ma."userId"
    AND ml."createdAt" <= ma."createdAt"
  ORDER BY ml."createdAt" DESC
  LIMIT 1
)
WHERE ma."moderationLogId" IS NULL;

-- Backfill active suspension pointer for currently suspended users.
UPDATE "User" AS u
SET "activeSuspensionLogId" = (
  SELECT ml.id
  FROM "ModerationLog" AS ml
  WHERE ml."userId" = u.id
    AND u."suspendedAt" IS NOT NULL
    AND ml."createdAt" >= u."suspendedAt" - INTERVAL '10 seconds'
    AND ml."createdAt" <= u."suspendedAt" + INTERVAL '10 seconds'
  ORDER BY ml."createdAt" DESC
  LIMIT 1
)
WHERE u."accountStatus" = 'suspended'
  AND u."activeSuspensionLogId" IS NULL;

UPDATE "User" AS u
SET "activeSuspensionLogId" = (
  SELECT ml.id
  FROM "ModerationLog" AS ml
  WHERE ml."userId" = u.id
    AND (
      ml.summary ILIKE '%suspend%'
      OR ml.summary ILIKE '%terminated%'
    )
  ORDER BY ml."createdAt" DESC
  LIMIT 1
)
WHERE u."accountStatus" = 'suspended'
  AND u."activeSuspensionLogId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_activeSuspensionLogId_key" ON "User"("activeSuspensionLogId");

-- CreateIndex
CREATE INDEX "ModerationAppeal_moderationLogId_idx" ON "ModerationAppeal"("moderationLogId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeSuspensionLogId_fkey" FOREIGN KEY ("activeSuspensionLogId") REFERENCES "ModerationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_moderationLogId_fkey" FOREIGN KEY ("moderationLogId") REFERENCES "ModerationLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
