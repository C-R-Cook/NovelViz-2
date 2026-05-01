-- Normalize legacy review status before enum contraction.
UPDATE "Book"
SET "status" = 'pending_review'
WHERE "status" = 'ready_for_review';

-- Recreate enum without ready_for_review.
ALTER TYPE "BookStatus" RENAME TO "BookStatus_old";

CREATE TYPE "BookStatus" AS ENUM (
  'draft',
  'pending_review',
  'rejected',
  'published',
  'unlisted',
  'processing'
);

ALTER TABLE "Book"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Book"
ALTER COLUMN "status" TYPE "BookStatus"
USING ("status"::text::"BookStatus");

ALTER TABLE "Book"
ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "BookStatus_old";
