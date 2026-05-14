export type LibraryBookRow = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string;
  genre: string | null;
  coverImageUrl: string | null;
  chapterTotal: number;
  progress: { currentChapterNumber: number; updatedAt: string } | null;
  removedFromCatalogue: boolean;
  queryCount: number;
  imageCount: number;
  lastQuestion: string | null;
  lastReadLabel: string;
};

export type LibraryTotals = {
  books: number;
  queries: number;
  images: number;
};
