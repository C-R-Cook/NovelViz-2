-- CreateEnum
CREATE TYPE "SpoilerProtection" AS ENUM ('INHERIT', 'PROTECTED', 'UNLOCKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "globalSpoilerProtection" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "UserBook" ADD COLUMN "spoilerProtection" "SpoilerProtection" NOT NULL DEFAULT 'INHERIT';
