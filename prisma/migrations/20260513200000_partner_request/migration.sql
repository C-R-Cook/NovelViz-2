-- CreateTable
CREATE TABLE "PartnerRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "publisherName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "catalogueNote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerRequest_userId_idx" ON "PartnerRequest"("userId");

-- CreateIndex
CREATE INDEX "PartnerRequest_createdAt_idx" ON "PartnerRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "PartnerRequest" ADD CONSTRAINT "PartnerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
