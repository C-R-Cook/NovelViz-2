import type { SpoilerProtection } from "@db";

export type GalleryLockKind = "none" | "chapter" | "unstarted" | "guest_blur";

export type GalleryImageCard = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAt: string;
  likeCount: number;
  isPublic: boolean;
  likedByViewer: boolean;
  commentCount: number;
  isFeatured: boolean;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  userName: string | null;
  userId: string;
  currentChapterNumber?: number;
  spoilerSetting?: SpoilerProtection;
  isLocked: boolean;
  lockKind: GalleryLockKind;
};

/** Synthetic gallery card ids for discover cover-fallback rows (not real GeneratedImage rows). */
export const GALLERY_COVER_FALLBACK_IMAGE_ID_PREFIX = "gallery-cover:";

export function isGalleryCoverFallbackImageId(id: string): boolean {
  return id.startsWith(GALLERY_COVER_FALLBACK_IMAGE_ID_PREFIX);
}

export type BookGalleryRow = {
  bookId: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  genre: string | null;
  totalPublicImages: number;
  images: GalleryImageCard[];
  /** Discover row showing the book's AI cover when no public gallery images qualify. */
  isCoverFallback?: boolean;
};

export type GalleryDiscoveryMode = "community" | "cover-fallback";

export type GalleryLibraryMeta = {
  hasLibraryBooks: boolean;
  hasVisibleLibraryImages: boolean;
};

export type GalleryPageApiResponse = {
  libraryRows: BookGalleryRow[];
  discoveryRows: BookGalleryRow[];
  discoveryMode: GalleryDiscoveryMode;
  userGenrePreferences: string[];
  libraryMeta: GalleryLibraryMeta;
};

export type GalleryClientSessionProps = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  viewerUserId: string | null;
  globalSpoilerProtection: boolean;
  genrePreferences: string[];
  libraryBookIds: string[];
  spoilerSettingsByBookId: Record<string, SpoilerProtection>;
  viewerDisplayName: string | null;
};
