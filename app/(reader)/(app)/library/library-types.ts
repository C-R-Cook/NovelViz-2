export type LibraryChapter = {
  id: string;
  sequenceNumber: number;
  title: string | null;
};

export type LibraryProgress = {
  currentChapterId: string;
  currentChapterNumber: number;
  updatedAt: string;
};

export type LibraryBookRow = {
  userBookId: string;
  bookId: string;
  title: string;
  author: string;
  genre: string | null;
  coverImageUrl: string | null;
  chapterTotal: number;
  chapters: LibraryChapter[];
  progress: LibraryProgress | null;
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
