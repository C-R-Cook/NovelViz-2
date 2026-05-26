import {
  descriptionFromGutenbergSummary,
  descriptionFromSubjects,
  fetchGutendexBookById,
  gutenbergEpubNoImagesUrl,
  pickBestDescription,
} from "@/lib/book-description";
import { resolveGutenbergCatalogDescription } from "@/lib/gutenberg-page-summary";
import { extractEpubMetadataFromOpf, openEpubPackage } from "@/lib/ingestion";
import { fetchOpenLibraryMetadata, fetchOpenLibraryWorkByKey } from "@/lib/open-library";

export type ResolvedBookDescription = {
  description: string | null;
  openLibraryKey: string | null;
  publishedYear: number | null;
  sources: string[];
};

async function descriptionFromGutenbergEpub(gutenbergId: number): Promise<string | null> {
  try {
    const res = await fetch(gutenbergEpubNoImagesUrl(gutenbergId), {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const { opfXml } = await openEpubPackage(buffer);
    const meta = extractEpubMetadataFromOpf(opfXml, { isPublicDomain: true });
    return meta.description?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a catalogue description without touching covers.
 * PG titles: `resolveGutenbergCatalogDescription` first (see gutenberg-import.md).
 * Then OL work key → OL search → EPUB OPF → subjects blurb.
 */
export async function resolveMissingBookDescription(options: {
  title: string;
  author: string;
  openLibraryKey?: string | null;
  gutenbergId?: number | null;
  epubBuffer?: Buffer | null;
  subjects?: string[];
  tryEpubDownload?: boolean;
  log?: (message: string) => void;
}): Promise<ResolvedBookDescription> {
  const log = options.log ?? (() => {});
  const sources: string[] = [];

  let openLibraryKey = options.openLibraryKey?.trim() || null;
  let publishedYear: number | null = null;
  let pgSummary: string | null = null;
  let olDescription: string | null = null;
  let epubDescription: string | null = null;
  let subjectLines = options.subjects ?? [];

  if (options.gutenbergId) {
    const gutendex = await fetchGutendexBookById(options.gutenbergId);
    if (gutendex) {
      if (subjectLines.length === 0) subjectLines = gutendex.subjects;
    }
    const hadGutendex = Boolean(descriptionFromGutenbergSummary(gutendex?.summaries));
    pgSummary = await resolveGutenbergCatalogDescription(
      options.gutenbergId,
      gutendex?.summaries,
    );
    if (pgSummary) {
      if (hadGutendex) {
        sources.push("gutenberg-summary");
        log("Description from Gutendex summary");
      } else {
        sources.push("gutenberg-page-scrape");
        log("Description from gutenberg.org page scrape");
      }
    }
  }

  if (openLibraryKey) {
    const fromKey = await fetchOpenLibraryWorkByKey(openLibraryKey);
    if (fromKey.description) {
      olDescription = fromKey.description;
      sources.push("open-library-key");
      log("Description from stored Open Library work key");
    }
    if (fromKey.firstPublishYear) publishedYear = fromKey.firstPublishYear;
  }

  if (!olDescription) {
    const ol = await fetchOpenLibraryMetadata(options.title, options.author, {
      existingOpenLibraryKey: openLibraryKey,
    });
    if (ol.openLibraryKey) openLibraryKey = ol.openLibraryKey;
    if (ol.description) {
      olDescription = ol.description;
      sources.push("open-library-search");
      log("Description from Open Library search");
    }
    if (ol.firstPublishYear && !publishedYear) publishedYear = ol.firstPublishYear;
  }

  if (options.epubBuffer?.length) {
    try {
      const { opfXml } = await openEpubPackage(options.epubBuffer);
      const meta = extractEpubMetadataFromOpf(opfXml, { isPublicDomain: true });
      epubDescription = meta.description?.trim() || null;
      if (epubDescription) {
        sources.push("epub-opf");
        log("Description from EPUB OPF metadata");
      }
    } catch {
      // non-fatal
    }
  } else if (options.tryEpubDownload && options.gutenbergId) {
    epubDescription = await descriptionFromGutenbergEpub(options.gutenbergId);
    if (epubDescription) {
      sources.push("gutenberg-epub");
      log("Description from downloaded Gutenberg EPUB");
    }
  }

  let subjectDescription: string | null = null;
  subjectDescription = descriptionFromSubjects(subjectLines);
  if (
    subjectDescription &&
    !pickBestDescription(pgSummary, olDescription, epubDescription)
  ) {
    sources.push("subjects-fallback");
    log("Using subject-tag fallback blurb");
  }

  const description = pickBestDescription(
    pgSummary,
    olDescription,
    epubDescription,
    subjectDescription,
  );

  return {
    description,
    openLibraryKey,
    publishedYear,
    sources,
  };
}
