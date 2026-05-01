-- CreateEnum
CREATE TYPE "ListingPreferenceAfterReview" AS ENUM ('published', 'unlisted');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN "listingPreferenceAfterReview" "ListingPreferenceAfterReview";
