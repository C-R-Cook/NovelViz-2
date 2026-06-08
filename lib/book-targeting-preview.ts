import { getEffectiveTargetGenresForBook } from "@/lib/book-targeting-validation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@db";

export type TargetingPreviewResult = {
  genrePreferenceReaders: number;
  libraryGenreReaders: number;
  ageLabel: string;
  ageReaders: number | null;
  genderLabel: string;
  genderReaders: number | null;
  countryLabel: string;
  countryReaders: number | null;
  combinedReach: number;
};

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

function strictDemographicWhere(book: {
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
}): Prisma.UserWhereInput[] {
  const clauses: Prisma.UserWhereInput[] = [{ role: "reader" }];

  if (book.featuredTargetAgeRanges.length > 0) {
    clauses.push({
      OR: [{ ageRange: null }, { ageRange: { in: book.featuredTargetAgeRanges as never[] } }],
    });
  }
  if (book.featuredTargetGenders.length > 0) {
    clauses.push({
      OR: [{ gender: null }, { gender: { in: book.featuredTargetGenders as never[] } }],
    });
  }
  if (book.featuredTargetCountries.length > 0) {
    clauses.push({
      OR: [{ country: null }, { country: { in: book.featuredTargetCountries } }],
    });
  }

  return clauses;
}

export async function getBookTargetingPreview(bookId: string): Promise<TargetingPreviewResult | null> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: {
      genre: true,
      featuredTargetAgeRanges: true,
      featuredTargetGenders: true,
      featuredTargetCountries: true,
      featuredTargetGenres: true,
    },
  });
  if (!book) return null;

  const effectiveGenres = getEffectiveTargetGenresForBook(book);

  const [genrePreferenceReaders, libraryGenreReaders, combinedReach] = await Promise.all([
    effectiveGenres.length === 0
      ? Promise.resolve(0)
      : prisma.user.count({
          where: {
            role: "reader",
            genrePreferences: { hasSome: effectiveGenres },
          },
        }),
    effectiveGenres.length === 0
      ? Promise.resolve(0)
      : prisma.userBook.findMany({
          where: {
            isActive: true,
            book: {
              status: "published",
              deletedAt: null,
              genre: { in: effectiveGenres as never[] },
            },
          },
          select: { userId: true },
          distinct: ["userId"],
        }).then((rows) => rows.length),
    prisma.user.count({
      where: { AND: strictDemographicWhere(book) },
    }),
  ]);

  let ageReaders: number | null = null;
  let ageLabel = "Field not set — all ages included";
  if (book.featuredTargetAgeRanges.length > 0) {
    ageReaders = await prisma.user.count({
      where: {
        role: "reader",
        ageRange: { in: book.featuredTargetAgeRanges as never[] },
      },
    });
    ageLabel = `${roundToNearest5(ageReaders)} readers match target age ranges`;
  }

  let genderReaders: number | null = null;
  let genderLabel = "Field not set — all genders included";
  if (book.featuredTargetGenders.length > 0) {
    genderReaders = await prisma.user.count({
      where: {
        role: "reader",
        gender: { in: book.featuredTargetGenders as never[] },
      },
    });
    genderLabel = `${roundToNearest5(genderReaders)} readers match target genders`;
  }

  let countryReaders: number | null = null;
  let countryLabel = "Field not set — all countries included";
  if (book.featuredTargetCountries.length > 0) {
    countryReaders = await prisma.user.count({
      where: {
        role: "reader",
        country: { in: book.featuredTargetCountries },
      },
    });
    countryLabel = `${roundToNearest5(countryReaders)} readers match target countries`;
  }

  return {
    genrePreferenceReaders,
    libraryGenreReaders,
    ageLabel,
    ageReaders,
    genderLabel,
    genderReaders,
    countryLabel,
    countryReaders,
    combinedReach,
  };
}

export function roundPreviewCounts(preview: TargetingPreviewResult) {
  return {
    genrePreferenceReaders: roundToNearest5(preview.genrePreferenceReaders),
    libraryGenreReaders: roundToNearest5(preview.libraryGenreReaders),
    combinedReach: roundToNearest5(preview.combinedReach),
    ageReaders: preview.ageReaders == null ? null : roundToNearest5(preview.ageReaders),
    genderReaders: preview.genderReaders == null ? null : roundToNearest5(preview.genderReaders),
    countryReaders: preview.countryReaders == null ? null : roundToNearest5(preview.countryReaders),
  };
}
