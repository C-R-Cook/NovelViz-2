CREATE TABLE IF NOT EXISTS "Like" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Like_userId_fkey'
  ) THEN
    ALTER TABLE "Like"
    ADD CONSTRAINT "Like_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Like_imageId_fkey'
  ) THEN
    ALTER TABLE "Like"
    ADD CONSTRAINT "Like_imageId_fkey"
    FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DELETE FROM "Like" l
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (PARTITION BY "userId", "imageId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
    FROM "Like"
  ) ranked
  WHERE ranked.rn > 1
) dupes
WHERE l.ctid = dupes.ctid;

CREATE INDEX IF NOT EXISTS "Like_imageId_idx" ON "Like"("imageId");
CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_imageId_key" ON "Like"("userId", "imageId");
