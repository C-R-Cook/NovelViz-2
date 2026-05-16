-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_SPOILER_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_SPOILER_CONFIRMED_GATED';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "spoilerGateChapter" INTEGER;

-- Backfill gate chapter from scan debug for existing hidden comments
UPDATE "Comment" c
SET "spoilerGateChapter" = COALESCE(
  NULLIF((c."spoilerScanDebug"->>'spoilerChapter')::integer, 0),
  gi."chapterNumberAtTime"
)
FROM "GeneratedImage" gi
WHERE gi.id = c."imageId"
  AND c."status" = 'HIDDEN_SPOILER'
  AND c."spoilerGateChapter" IS NULL;
