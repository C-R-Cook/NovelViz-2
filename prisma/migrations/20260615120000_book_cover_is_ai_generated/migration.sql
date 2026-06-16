-- Gallery discover fallback: flag books whose cover art came from Cover AI.

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "coverIsAiGenerated" BOOLEAN NOT NULL DEFAULT false;
