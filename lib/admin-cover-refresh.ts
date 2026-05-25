import {
  fetchOpenLibraryMetadata,
  type OpenLibraryMetadata,
} from "@/lib/open-library";
import { openLibraryCoverUrl, uploadOpenLibraryCover } from "@/lib/open-library-cover";
import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";

/** Gutendex / Project Gutenberg cache JPEG (often the generic PG logo cover). */
export const GUTENBERG_CACHE_COVER_RE = /gutenberg\.org\/cache\/epub/i;

export type CoverRefreshListRow = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  gutenbergId: number | null;
  openLibraryKey: string | null;
};

export type CoverRefreshScanResult = {
  bookId: string;
  gutendexCoverUrl: string | null;
  likelyGenericGutenbergCover: boolean;
  openLibraryCoverId: number | null;
  openLibraryCoverPreviewUrl: string | null;
  openLibraryKey: string | null;
  openLibraryCoverAvailable: boolean;
};

export type CoverRefreshApplyResult = {
  bookId: string;
  ok: boolean;
  coverImageUrl?: string;
  openLibraryKey?: string | null;
  error?: string;
};

export function isLikelyProjectGutenbergPlaceholderCover(
  gutendexCoverUrl: string | null | undefined,
): boolean {
  if (!gutendexCoverUrl?.trim()) return false;
  return GUTENBERG_CACHE_COVER_RE.test(gutendexCoverUrl) && /\.cover\./i.test(gutendexCoverUrl);
}

export function openLibraryCoverPreviewUrl(coverId: number): string {
  return openLibraryCoverUrl(coverId, "M");
}

export async function fetchGutendexCoverUrl(gutenbergId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://gutendex.com/books/?ids=${gutenbergId}`, {
      headers: { "User-Agent": "NovelViz/1.0 (admin-cover-refresh)" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ formats?: Record<string, string> }>;
    };
    return data.results?.[0]?.formats?.["image/jpeg"]?.trim() || null;
  } catch {
    return null;
  }
}

export async function listCoverRefreshCandidates(
  status: BookStatus = "pending_review",
): Promise<CoverRefreshListRow[]> {
  const books = await prisma.book.findMany({
    where: { status, deletedAt: null },
    orderBy: [{ title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
      gutenbergId: true,
      openLibraryKey: true,
    },
  });
  return books;
}

export async function scanBookCoverRefresh(
  book: CoverRefreshListRow,
): Promise<CoverRefreshScanResult> {
  const [gutendexCoverUrl, ol] = await Promise.all([
    book.gutenbergId ? fetchGutendexCoverUrl(book.gutenbergId) : Promise.resolve(null),
    fetchOpenLibraryMetadata(book.title, book.author, {
      existingOpenLibraryKey: book.openLibraryKey,
    }),
  ]);

  const openLibraryCoverId = ol.coverId;
  return {
    bookId: book.id,
    gutendexCoverUrl,
    likelyGenericGutenbergCover: isLikelyProjectGutenbergPlaceholderCover(gutendexCoverUrl),
    openLibraryCoverId,
    openLibraryCoverPreviewUrl: openLibraryCoverId
      ? openLibraryCoverPreviewUrl(openLibraryCoverId)
      : null,
    openLibraryKey: ol.openLibraryKey,
    openLibraryCoverAvailable: openLibraryCoverId !== null,
  };
}

export async function applyOpenLibraryCoverToBook(
  book: CoverRefreshListRow,
): Promise<CoverRefreshApplyResult> {
  const ol = await fetchOpenLibraryMetadata(book.title, book.author, {
    existingOpenLibraryKey: book.openLibraryKey,
  });

  if (!ol.coverId) {
    return { bookId: book.id, ok: false, error: "No Open Library cover found" };
  }

  const coverImageUrl = await uploadOpenLibraryCover(book.id, ol.coverId);
  if (!coverImageUrl) {
    return { bookId: book.id, ok: false, error: "Cover upload failed" };
  }

  await prisma.book.update({
    where: { id: book.id },
    data: {
      coverImageUrl,
      ...(ol.openLibraryKey ? { openLibraryKey: ol.openLibraryKey } : {}),
    },
  });

  return {
    bookId: book.id,
    ok: true,
    coverImageUrl,
    openLibraryKey: ol.openLibraryKey,
  };
}
