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
): Promise<Pick<OpenLibraryMetadata, "description" | "firstPublishYear">> {
  const key = normalizeWorkKey(openLibraryKey);
  if (!key.startsWith("/works/")) {
    return { description: null, firstPublishYear: null };
  }
  try {
    const workRes = await fetch(`https://openlibrary.org${key}.json`, {
      headers: OL_HEADERS,
      signal: AbortSignal.timeout(25_000),
    });
    if (!workRes.ok) return { description: null, firstPublishYear: null };
    const workData = (await workRes.json()) as {
      description?: unknown;
      first_publish_date?: string;
    };
    let firstPublishYear: number | null = null;
    if (workData.first_publish_date) {
      const year = Number.parseInt(workData.first_publish_date.slice(0, 4), 10);
      if (Number.isInteger(year) && year > 0) firstPublishYear = year;
    }
    return {
      description: parseWorkDescription(workData.description),
      firstPublishYear,
    };
  } catch {
    return { description: null, firstPublishYear: null };
  }
}

type SearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

function pickBestSearchDoc(docs: SearchDoc[], title: string, author: string): SearchDoc | null {
  if (docs.length === 0) return null;
  const scored = docs.map((doc) => {
    let score = 0;
    if (normaliseTitle(doc.title) === normaliseTitle(title)) score += 3;
    if (authorNameMatches(author, doc.author_name)) score += 4;
    return { doc, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.doc ?? docs[0] ?? null;
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

  if (existingKey) {
    const fromKey = await fetchOpenLibraryWorkByKey(existingKey);
    descriptionFromKey = fromKey.description;
    yearFromKey = fromKey.firstPublishYear;
  }

  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const searchRes = await fetch(
      `https://openlibrary.org/search.json?q=${query}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`,
      {
        headers: OL_HEADERS,
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!searchRes.ok) {
      if (existingKey) {
        return {
          description: descriptionFromKey,
          firstPublishYear: yearFromKey,
          openLibraryKey: existingKey,
          coverId: null,
        };
      }
      return empty;
    }

    const searchData = (await searchRes.json()) as { docs?: SearchDoc[] };
    const docs = searchData.docs;
    if (!docs || docs.length === 0) {
      if (existingKey) {
        return {
          description: descriptionFromKey,
          firstPublishYear: yearFromKey,
          openLibraryKey: existingKey,
          coverId: null,
        };
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

    return {
      description,
      firstPublishYear: best.first_publish_year ?? yearFromKey ?? null,
      openLibraryKey: workKey,
      coverId: best.cover_i ?? null,
    };
  } catch (e) {
    console.error("[open-library] fetchOpenLibraryMetadata failed", e);
    if (existingKey) {
      return {
        description: descriptionFromKey,
        firstPublishYear: yearFromKey,
        openLibraryKey: existingKey,
        coverId: null,
      };
    }
    return empty;
  }
}
