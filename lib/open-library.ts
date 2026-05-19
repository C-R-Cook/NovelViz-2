// Open Library metadata enrichment for book records
// API docs: https://openlibrary.org/developers/api
// No API key required.

export interface OpenLibraryMetadata {
  description: string | null;
  firstPublishYear: number | null;
  openLibraryKey: string | null; // e.g. "/works/OL45883W"
  coverId: number | null; // Open Library cover ID (for future use)
}

/**
 * Search Open Library by title and author, return best match metadata.
 * Returns null fields for anything not found rather than throwing.
 */
export async function fetchOpenLibraryMetadata(
  title: string,
  author: string,
): Promise<OpenLibraryMetadata> {
  const empty: OpenLibraryMetadata = {
    description: null,
    firstPublishYear: null,
    openLibraryKey: null,
    coverId: null,
  };

  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const searchRes = await fetch(
      `https://openlibrary.org/search.json?q=${query}&limit=5&fields=key,title,author_name,first_publish_year,cover_i`,
      {
        headers: { "User-Agent": "NovelViz/1.0 (contact@novelviz.com)" },
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!searchRes.ok) return empty;

    const searchData = (await searchRes.json()) as {
      docs?: Array<{
        key: string;
        title: string;
        author_name?: string[];
        first_publish_year?: number;
        cover_i?: number;
      }>;
    };
    const docs = searchData.docs;
    if (!docs || docs.length === 0) return empty;

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const exactMatch = docs.find((d) => normalise(d.title) === normalise(title));
    const best = exactMatch ?? docs[0];
    if (!best) return empty;

    let description: string | null = null;
    if (best.key) {
      try {
        const workRes = await fetch(`https://openlibrary.org${best.key}.json`, {
          headers: { "User-Agent": "NovelViz/1.0 (contact@novelviz.com)" },
          signal: AbortSignal.timeout(25_000),
        });
        if (workRes.ok) {
          const workData = (await workRes.json()) as {
            description?: string | { type?: string; value?: string };
          };
          if (typeof workData.description === "string") {
            description = workData.description;
          } else if (
            typeof workData.description === "object" &&
            workData.description?.value
          ) {
            description = workData.description.value;
          }
          if (description && description.length > 1000) {
            description = `${description.slice(0, 997)}...`;
          }
        }
      } catch {
        // Work fetch failed — continue with other fields.
      }
    }

    return {
      description,
      firstPublishYear: best.first_publish_year ?? null,
      openLibraryKey: best.key ?? null,
      coverId: best.cover_i ?? null,
    };
  } catch (e) {
    console.error("[open-library] fetchOpenLibraryMetadata failed", e);
    return empty;
  }
}
