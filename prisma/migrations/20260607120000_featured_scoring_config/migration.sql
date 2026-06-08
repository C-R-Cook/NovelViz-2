-- CreateTable
CREATE TABLE "FeaturedScoringConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "scoreGenrePrefMatch" INTEGER NOT NULL DEFAULT 40,
    "scoreLibraryDeep" INTEGER NOT NULL DEFAULT 25,
    "scoreLibraryStarted" INTEGER NOT NULL DEFAULT 20,
    "scoreLibraryRecentUnread" INTEGER NOT NULL DEFAULT 5,
    "scoreLibraryStaleUnread" INTEGER NOT NULL DEFAULT 2,
    "libraryMatchCap" INTEGER NOT NULL DEFAULT 3,
    "libraryRecencyDays" INTEGER NOT NULL DEFAULT 90,
    "scoreRecencyFresh" INTEGER NOT NULL DEFAULT 30,
    "scoreRecencyRecent" INTEGER NOT NULL DEFAULT 15,
    "scoreRecencyWarm" INTEGER NOT NULL DEFAULT 5,
    "recencyFreshDays" INTEGER NOT NULL DEFAULT 7,
    "recencyRecentDays" INTEGER NOT NULL DEFAULT 30,
    "recencyWarmDays" INTEGER NOT NULL DEFAULT 90,
    "scoreGenderMatch" INTEGER NOT NULL DEFAULT 15,
    "scoreAgeMatch" INTEGER NOT NULL DEFAULT 12,
    "scoreCountryMatch" INTEGER NOT NULL DEFAULT 8,
    "penaltyGenderMismatch" INTEGER NOT NULL DEFAULT 40,
    "penaltyAgeMismatch" INTEGER NOT NULL DEFAULT 30,
    "penaltyCountryMismatch" INTEGER NOT NULL DEFAULT 15,
    "minCarouselSlots" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "FeaturedScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedScoringHistory" (
    "id" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedBy" TEXT NOT NULL,
    "savedByName" TEXT NOT NULL,
    "scoreGenrePrefMatch" INTEGER NOT NULL,
    "scoreLibraryDeep" INTEGER NOT NULL,
    "scoreLibraryStarted" INTEGER NOT NULL,
    "scoreLibraryRecentUnread" INTEGER NOT NULL,
    "scoreLibraryStaleUnread" INTEGER NOT NULL,
    "libraryMatchCap" INTEGER NOT NULL,
    "libraryRecencyDays" INTEGER NOT NULL,
    "scoreRecencyFresh" INTEGER NOT NULL,
    "scoreRecencyRecent" INTEGER NOT NULL,
    "scoreRecencyWarm" INTEGER NOT NULL,
    "recencyFreshDays" INTEGER NOT NULL,
    "recencyRecentDays" INTEGER NOT NULL,
    "recencyWarmDays" INTEGER NOT NULL,
    "scoreGenderMatch" INTEGER NOT NULL,
    "scoreAgeMatch" INTEGER NOT NULL,
    "scoreCountryMatch" INTEGER NOT NULL,
    "penaltyGenderMismatch" INTEGER NOT NULL,
    "penaltyAgeMismatch" INTEGER NOT NULL,
    "penaltyCountryMismatch" INTEGER NOT NULL,
    "minCarouselSlots" INTEGER NOT NULL,

    CONSTRAINT "FeaturedScoringHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeaturedScoringHistory_savedAt_idx" ON "FeaturedScoringHistory"("savedAt");
