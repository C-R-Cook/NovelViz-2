-- PartnerRequest.publisherName is optional (dashboard form no longer requires it).
ALTER TABLE "PartnerRequest" ALTER COLUMN "publisherName" DROP NOT NULL;
