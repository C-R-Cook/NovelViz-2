import cloudinary from "@/lib/cloudinary";
import { fetchOpenLibraryMetadata } from "@/lib/open-library";

const COVER_SIZES = ["L", "M", "S"] as const;

export type GutenbergBookEnrichment = {
  openLibraryKey: string | null;
  description: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
};

function sniffImageMimeType(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

export function openLibraryCoverUrl(coverId: number, size: (typeof COVER_SIZES)[number] = "L"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/** Direct download (may fail if covers.openlibrary.org is blocked locally). */
export async function fetchOpenLibraryCoverBuffer(
  coverId: number,
  size: (typeof COVER_SIZES)[number] = "L",
): Promise<Buffer | null> {
  const url = openLibraryCoverUrl(coverId, size);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Upload cover bytes to Cloudinary under `novelviz/covers/{bookId}`. */
export async function uploadBookCoverBuffer(bookId: string, coverBuf: Buffer): Promise<string> {
  const mime = sniffImageMimeType(coverBuf);
  const dataUri = `data:${mime};base64,${coverBuf.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "novelviz/covers",
    public_id: bookId,
    overwrite: true,
    transformation: [{ width: 400, height: 600, crop: "fit" }],
    resource_type: "image",
  });
  return result.secure_url;
}

/**
 * Ask Cloudinary to fetch the cover URL (bypasses local network blocks on covers.openlibrary.org).
 */
async function uploadOpenLibraryCoverViaCloudinary(
  bookId: string,
  coverId: number,
): Promise<string | null> {
  for (const size of COVER_SIZES) {
    const remoteUrl = openLibraryCoverUrl(coverId, size);
    try {
      const result = await cloudinary.uploader.upload(remoteUrl, {
        folder: "novelviz/covers",
        public_id: bookId,
        overwrite: true,
        transformation: [{ width: 400, height: 600, crop: "fit" }],
        resource_type: "image",
      });
      return result.secure_url;
    } catch {
      // Try smaller size or next attempt.
    }
  }
  return null;
}

/** Fetch from Open Library and upload; returns Cloudinary URL or null. */
export async function uploadOpenLibraryCover(
  bookId: string,
  coverId: number,
): Promise<string | null> {
  const viaCloudinary = await uploadOpenLibraryCoverViaCloudinary(bookId, coverId);
  if (viaCloudinary) return viaCloudinary;

  for (const size of COVER_SIZES) {
    const buf = await fetchOpenLibraryCoverBuffer(coverId, size).catch(() => null);
    if (buf) {
      try {
        return await uploadBookCoverBuffer(bookId, buf);
      } catch {
        // continue
      }
    }
  }
  return null;
}

async function fetchGutendexCover(
  bookId: string,
  gutendexCoverUrl: string,
  log: (message: string) => void,
): Promise<string | null> {
  try {
    const res = await fetch(gutendexCoverUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const uploaded = await uploadBookCoverBuffer(bookId, buf);
    if (uploaded) {
      log("Cover from Gutendex");
    }
    return uploaded;
  } catch (e) {
    log(`Gutendex cover error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Single Open Library lookup for metadata, plus cover resolution.
 * Default: Gutenberg EPUB cover, then Gutendex URL, then Open Library.
 * Used by gutenberg-ingest and gutenberg-enrich.
 */
export async function resolveGutenbergBookEnrichment(options: {
  bookId: string;
  title: string;
  author: string;
  /** Cover image bytes extracted from the Gutenberg EPUB (preferred). */
  epubCoverBuffer?: Buffer | null;
  gutendexCoverUrl?: string | null;
  existingDescription?: string | null;
  existingPublishedYear?: number | null;
  existingCoverUrl?: string | null;
  /** When true, try Open Library before Gutendex (e.g. `gutenberg-enrich --refresh-covers`). */
  preferOpenLibraryCover?: boolean;
  log?: (message: string) => void;
}): Promise<GutenbergBookEnrichment> {
  const log = options.log ?? (() => {});
  const preferOlCover = options.preferOpenLibraryCover === true;
  const gutendexUrl = options.gutendexCoverUrl?.trim() || null;

  const ol = await fetchOpenLibraryMetadata(options.title, options.author);

  const description =
    ol.description &&
    (!options.existingDescription || options.existingDescription.trim() === "")
      ? ol.description
      : options.existingDescription?.trim() || ol.description;

  const publishedYear =
    ol.firstPublishYear && !options.existingPublishedYear
      ? ol.firstPublishYear
      : options.existingPublishedYear ?? ol.firstPublishYear;

  let coverImageUrl = options.existingCoverUrl?.trim() || null;

  async function tryEpubCover(): Promise<void> {
    const buf = options.epubCoverBuffer;
    if (!buf?.length || coverImageUrl) return;
    try {
      coverImageUrl = await uploadBookCoverBuffer(options.bookId, buf);
      log("Cover from Gutenberg EPUB");
    } catch (e) {
      log(`EPUB cover upload error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function tryOpenLibraryCover(): Promise<void> {
    if (!ol.coverId || coverImageUrl) return;
    const uploaded = await uploadOpenLibraryCover(options.bookId, ol.coverId);
    if (uploaded) {
      log("Cover from Open Library (via Cloudinary fetch)");
      coverImageUrl = uploaded;
    }
  }

  async function tryGutendexCover(): Promise<void> {
    if (!gutendexUrl || coverImageUrl) return;
    const gutendex = await fetchGutendexCover(options.bookId, gutendexUrl, log);
    if (gutendex) coverImageUrl = gutendex;
  }

  if (preferOlCover) {
    await tryOpenLibraryCover();
    if (!coverImageUrl) {
      log("Open Library cover unavailable — trying Gutendex");
    }
    await tryGutendexCover();
  } else {
    await tryEpubCover();
    await tryGutendexCover();
    if (!coverImageUrl) {
      log("No Gutenberg cover — trying Open Library");
    }
    await tryOpenLibraryCover();
  }

  return {
    openLibraryKey: ol.openLibraryKey,
    description: description ?? null,
    publishedYear: publishedYear ?? null,
    coverImageUrl,
  };
}

/** @deprecated Use resolveGutenbergBookEnrichment */
export async function resolveBookCoverUrl(options: {
  bookId: string;
  title: string;
  author: string;
  gutendexCoverUrl?: string | null;
  log?: (message: string) => void;
}): Promise<string | null> {
  const result = await resolveGutenbergBookEnrichment({
    bookId: options.bookId,
    title: options.title,
    author: options.author,
    gutendexCoverUrl: options.gutendexCoverUrl,
    log: options.log,
  });
  return result.coverImageUrl;
}
