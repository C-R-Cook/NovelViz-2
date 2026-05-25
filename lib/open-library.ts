// Open Library metadata enrichment for book records
// API docs: https://openlibrary.org/developers/api
// No API key required.

import { stripHtmlToPlainText, truncateDescription } from "@/lib/book-description";

export interface OpenLibraryMetadata {
  description: string | null;
  firstPublishYear: number | null;
  openLibraryKey: string | null; // e.g. "/works/OL45883W"
  coverId: number | null; // Open Library cover ID (for future use)
}

const OL_HEADERS = { "User-Agent": "NovelViz/1.0 (contact@novelviz.com)" };

function normaliseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseAuthor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function authorTokens(author: string): string[] {
  return normaliseAuthor(author)
    .split(/[\s,]+/)
    .filter((t) => t.length > 1);
}

function authorNameMatches(bookAuthor: string, olAuthors: string[] | undefined): boolean {
  if (!olAuthors?.length) return false;
  const tokens = authorTokens(bookAuthor);
  if (tokens.length === 0) return false;
  return olAuthors.some((name) => {
    const hay = normaliseAuthor(name);
    return tokens.every((t) => hay.includes(t));
  });
}

function parseWorkDescription(raw: unknown): string | null {
  if (typeof raw === "string") {
    return truncateDescription(stripHtmlToPlainText(raw));
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "value" in raw &&
    typeof (raw as { value?: unknown }).value === "string"
  ) {
    return truncateDescription(stripHtmlToPlainText((raw as { value: string }).value));
  }
  return null;
}

function normalizeWorkKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("/works/")) return trimmed;
  if (trimmed.startsWith("works/")) return `/${trimmed}`;
  return trimmed;
}

/** Fetch description (and year when present) from a known work key. */
export async function fetchOpenLibraryWorkByKey(
  openLibraryKey: string,
): Promise<Pick<OpenLibraryMetadata, "description" | "firstPublishYear"> & { coverIds: number[] }> {
  const key = normalizeWorkKey(openLibraryKey);
  if (!key.startsWith("/works/")) {
    return { description: null, firstPublishYear: null, coverIds: [] };
  }
  try {
    const workRes = await fetch(`https://openlibrary.org${key}.json`, {
      headers: OL_HEADERS,
      signal: AbortSignal.timeout(25_000),
    });
    if (!workRes.ok) return { description: null, firstPublishYear: null, coverIds: [] };
    const workData = (await workRes.json()) as {
      description?: unknown;
      first_publish_date?: string;
      covers?: unknown;
    };
    let firstPublishYear: number | null = null;
    if (workData.first_publish_date) {
      const year = Number.parseInt(workData.first_publish_date.slice(0, 4), 10);
      if (Number.isInteger(year) && year > 0) firstPublishYear = year;
    }
    const coverIds = parseCoverIdList(workData.covers);
    return {
      description: parseWorkDescription(workData.description),
      firstPublishYear,
      coverIds,
    };
  } catch {
    return { description: null, firstPublishYear: null, coverIds: [] };
  }
}

function parseCoverIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
}

async function fetchOpenLibraryEditionCoverId(editionKey: string): Promise<number | null> {
  const trimmed = editionKey.trim().replace(/^\/books\//, "").replace(/^books\//, "");
  if (!trimmed) return null;
  try {
    const res = await fetch(`https://openlibrary.org/books/${trimmed}.json`, {
      headers: OL_HEADERS,
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { covers?: unknown };
    return parseCoverIdList(data.covers)[0] ?? null;
  } catch {
    return null;
  }
}

/** Resolve a usable cover ID from search hits and/or a known work key. */
export async function resolveOpenLibraryCoverId(options: {
  docs: SearchDoc[];
  title: string;
  author: string;
  workKey: string | null;
}): Promise<number | null> {
  const best = pickBestSearchDoc(options.docs, options.title, options.author);
  if (best?.cover_i) return best.cover_i;

  for (const doc of options.docs) {
    if (doc.cover_i) return doc.cover_i;
  }

  const workKey = options.workKey ?? best?.key ?? null;
  if (workKey) {
    const fromWork = await fetchOpenLibraryWorkByKey(workKey);
    if (fromWork.coverIds[0]) return fromWork.coverIds[0];
  }

  if (best?.cover_edition_key) {
    const fromEdition = await fetchOpenLibraryEditionCoverId(best.cover_edition_key);
    if (fromEdition) return fromEdition;
  }

  for (const doc of options.docs) {
    if (doc.cover_edition_key) {
      const fromEdition = await fetchOpenLibraryEditionCoverId(doc.cover_edition_key);
      if (fromEdition) return fromEdition;
    }
  }

  return null;
}

type SearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  cover_edition_key?: string;
};

const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,cover_edition_key";

function pickBestSearchDoc(docs: SearchDoc[], title: string, author: string): SearchDoc | null {
  if (docs.length === 0) return null;
  const scored = docs.map((doc) => {
    let score = 0;
    if (normaliseTitle(doc.title) === normaliseTitle(title)) score += 3;
    if (authorNameMatches(author, doc.author_name)) score += 4;
    if (doc.cover_i) score += 2;
    return { doc, score };
  });
  scored.sort((a, b) => b.score - a.score || (b.doc.cover_i ? 1 : 0) - (a.doc.cover_i ? 1 : 0));
  return scored[0]?.doc ?? docs[0] ?? null;
}

async function searchOpenLibraryDocs(title: string, author: string): Promise<SearchDoc[]> {
  const urls = [
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=8&fields=${SEARCH_FIELDS}`,
    `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author}`)}&limit=8&fields=${SEARCH_FIELDS}`,
  ];
  const seen = new Set<string>();
  const docs: SearchDoc[] = [];
  for (const url of urls) {
    try {
      const searchRes = await fetch(url, {
        headers: OL_HEADERS,
        signal: AbortSignal.timeout(25_000),
      });
      if (!searchRes.ok) continue;
      const searchData = (await searchRes.json()) as { docs?: SearchDoc[] };
      for (const doc of searchData.docs ?? []) {
        if (!doc.key || seen.has(doc.key)) continue;
        seen.add(doc.key);
        docs.push(doc);
      }
    } catch {
      // try next query shape
    }
  }
  return docs;
}

function metadataFromExistingKey(
  existingKey: string,
  descriptionFromKey: string | null,
  yearFromKey: number | null,
  coverId: number | null,
): OpenLibraryMetadata {
  return {
    description: descriptionFromKey,
    firstPublishYear: yearFromKey,
    openLibraryKey: existingKey,
    coverId,
  };
}

/**
 * Search Open Library by title and author, return best match metadata.
 * When `existingOpenLibraryKey` is set, fetches that work first for description.
 */
export async function fetchOpenLibraryMetadata(
  title: string,
  author: string,
  options?: { existingOpenLibraryKey?: string | null },
): Promise<OpenLibraryMetadata> {
  const empty: OpenLibraryMetadata = {
    description: null,
    firstPublishYear: null,
    openLibraryKey: null,
    coverId: null,
  };

  const existingKey = options?.existingOpenLibraryKey?.trim() || null;
  let descriptionFromKey: string | null = null;
  let yearFromKey: number | null = null;
  let coverFromKey: number | null = null;

  if (existingKey) {
    const fromKey = await fetchOpenLibraryWorkByKey(existingKey);
    descriptionFromKey = fromKey.description;
    yearFromKey = fromKey.firstPublishYear;
    coverFromKey = fromKey.coverIds[0] ?? null;
  }

  try {
    const docs = await searchOpenLibraryDocs(title, author);
    if (docs.length === 0) {
      if (existingKey) {
        return metadataFromExistingKey(existingKey, descriptionFromKey, yearFromKey, coverFromKey);
      }
      return empty;
    }

    const best = pickBestSearchDoc(docs, title, author);
    if (!best) return empty;

    let description = descriptionFromKey;
    const workKey = existingKey ?? best.key ?? null;

    if (!description && best.key) {
      const fromWork = await fetchOpenLibraryWorkByKey(best.key);
      description = fromWork.description;
      if (!yearFromKey) yearFromKey = fromWork.firstPublishYear;
    }

    const coverId =
      (await resolveOpenLibraryCoverId({ docs, title, author, workKey })) ?? coverFromKey;

    return {
      description,
      firstPublishYear: best.first_publish_year ?? yearFromKey ?? null,
      openLibraryKey: workKey,
      coverId,
    };
  } catch (e) {
    console.error("[open-library] fetchOpenLibraryMetadata failed", e);
    if (existingKey) {
      return metadataFromExistingKey(existingKey, descriptionFromKey, yearFromKey, coverFromKey);
    }
    return empty;
  }
}
