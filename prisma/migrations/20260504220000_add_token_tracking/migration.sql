-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "embeddingTokens" INTEGER,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "subjectTokens" INTEGER;

-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "embeddingTokens" INTEGER,
ADD COLUMN     "promptTokens" INTEGER;
