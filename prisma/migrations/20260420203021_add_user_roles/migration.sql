-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('reader', 'partner', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'reader';
