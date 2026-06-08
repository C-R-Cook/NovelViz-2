import {
  libraryEntriesFromDb,
  type UserScoringProfile,
} from "@/lib/featured-book-scoring";
import { prisma } from "@/lib/prisma";

export async function getUserScoringProfile(
  userId: string,
  libraryRecencyDays: number,
): Promise<UserScoringProfile> {
  const [user, libraryRows, progressRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        genrePreferences: true,
        ageRange: true,
        gender: true,
        country: true,
      },
    }),
    prisma.userBook.findMany({
      where: {
        userId,
        isActive: true,
        book: { status: "published", deletedAt: null },
      },
      select: {
        addedAt: true,
        bookId: true,
        book: {
          select: {
            genre: true,
            _count: { select: { chapters: true } },
          },
        },
      },
    }),
    prisma.readingProgress.findMany({
      where: { userId },
      select: { bookId: true, currentChapterNumber: true },
    }),
  ]);

  if (!user) {
    return {
      genrePreferences: [],
      libraryBooks: [],
      ageRange: null,
      gender: null,
      country: null,
    };
  }

  const progressByBook = new Map(progressRows.map((p) => [p.bookId, p.currentChapterNumber]));

  const libraryBooks = libraryRows
    .map((row) =>
      libraryEntriesFromDb({
        genre: row.book.genre,
        currentChapterNumber: progressByBook.get(row.bookId) ?? 0,
        chapterTotal: row.book._count.chapters,
        addedAt: row.addedAt,
        recencyDays: libraryRecencyDays,
      }),
    )
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return {
    genrePreferences: user.genrePreferences,
    ageRange: user.ageRange,
    gender: user.gender,
    country: user.country,
    libraryBooks,
  };
}
