-- Cover AI: per-book quota, admin settings singleton, partner quota requests.

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "coverGenAttemptsConsumed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "coverGenAttemptsGranted" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS "CoverAiAdminSettings" (
    "id" TEXT NOT NULL,
    "basePromptPrefix" TEXT NOT NULL,
    "titlePromptTemplate" TEXT NOT NULL,
    "authorPromptTemplate" TEXT NOT NULL,
    "modelsJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverAiAdminSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoverAiQuotaRequest" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "CoverAiQuotaRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoverAiQuotaRequest_bookId_idx" ON "CoverAiQuotaRequest"("bookId");
CREATE INDEX IF NOT EXISTS "CoverAiQuotaRequest_bookId_handledAt_idx" ON "CoverAiQuotaRequest"("bookId", "handledAt");

DO $$
BEGIN
  ALTER TABLE "CoverAiQuotaRequest" ADD CONSTRAINT "CoverAiQuotaRequest_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CoverAiQuotaRequest" ADD CONSTRAINT "CoverAiQuotaRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
