-- User legal consent audit fields (over 18, terms, privacy).
ALTER TABLE "User" ADD COLUMN "over18ConfirmedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsDocumentVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyDocumentVersion" TEXT;
