/** Strip HTML tags Open Library sometimes returns in descriptions. */
export function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const GUTENBERG_BOILERPLATE =
  /project gutenberg|ebook of|this ebook is for the use of anyone anywhere/i;

/** True when text is worth showing as a catalogue description. */
export function isUsableDescription(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = stripHtmlToPlainText(text);
  if (t.length < 40) return false;
  if (GUTENBERG_BOILERPLATE.test(t) && t.length < 220) return false;
  return true;
}

export function truncateDescription(text: string, max = 1000): string {
  const plain = stripHtmlToPlainText(text);
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 3)}...`;
}

/** Prefer the longest usable candidate; otherwise longest non-empty string. */
export function pickBestDescription(
  ...candidates: (string | null | undefined)[]
): string | null {
  const normalized = candidates
    .map((c) => (c?.trim() ? truncateDescription(c) : null))
    .filter((c): c is string => Boolean(c));

  const usable = normalized.filter(isUsableDescription);
  const pool = usable.length > 0 ? usable : normalized;
  if (pool.length === 0) return null;
  return pool.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Prefix for `descriptionFromSubjects()` fallback blurbs. */
export const PG_SUBJECT_FALLBACK_PREFIX = "Public domain classic. Subjects:";

/** Common low-quality Gutenberg / ingest placeholder opening. */
export const PG_IN_PUBLISHED_ORDER_PREFIX = "in published order";

/** Last-resort blurb from Gutendex / queue subject tags. */
export function descriptionFromSubjects(subjects: string[]): string | null {
  if (subjects.length === 0) return null;
  const cleaned = subjects
    .slice(0, 6)
    .map((s) => s.replace(/\s*--\s*.*$/, "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return null;
  return `${PG_SUBJECT_FALLBACK_PREFIX} ${cleaned.join("; ")}.`;
}

/**
 * Project Gutenberg header search UI at the start of a description (bad page scrape).
 * Close label `X`, then submit `Go!` — often on two lines; optional `Quick search` between.
 * Any trailing nav/summary text still counts as junk when this prefix is present.
 */
export const PG_SEARCH_CHROME_PREFIX =
  /^\s*X\s*(?:\r?\n\s*Quick search\s*)?\r?\n\s*Go!/i;

export function isGutenbergSearchChromeDescription(text: string | null | undefined): boolean {
  const plain = stripHtmlToPlainText(text ?? "");
  if (!plain) return false;
  if (PG_SEARCH_CHROME_PREFIX.test(plain)) return true;
  if (/^\s*X\s+Go!/i.test(plain)) return true;
  return false;
}

/** Whether `--gutenberg-summaries` backfill should touch this book's description. */
export function isDescriptionEligibleForGutenbergSummaryBackfill(
  description: string | null | undefined,
): boolean {
  const d = description?.trim() ?? "";
  if (!d) return true;
  if (d.toLowerCase().startsWith(PG_IN_PUBLISHED_ORDER_PREFIX)) return true;
  if (d.startsWith(PG_SUBJECT_FALLBACK_PREFIX)) return true;
  if (isGutenbergSearchChromeDescription(d)) return true;
  return false;
}

export function gutenbergEpubNoImagesUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/ebooks/${gutenbergId}.epub.noimages`;
}

/** Trailing boilerplate on Gutendex / Project Gutenberg auto-summaries. */
export const PG_AUTO_SUMMARY_SUFFIX =
  /\s*\(This is an automatically generated summary\.\)\s*$/i;

export function stripGutenbergAutoSummarySuffix(text: string): string {
  return text.replace(PG_AUTO_SUMMARY_SUFFIX, "").trim();
}

/** Normalize raw PG/Gutendex summary text (HTML allowed; suffix stripped). */
export function normalizeGutenbergSummaryText(raw: string): string | null {
  const plain = stripHtmlToPlainText(stripGutenbergAutoSummarySuffix(raw.trim()));
  if (!plain || isGutenbergSearchChromeDescription(plain)) return null;
  const truncated = truncateDescription(plain);
  return isUsableDescription(truncated) ? truncated : truncated.length >= 40 ? truncated : null;
}

/** Normalize Gutendex `summaries[0]` for catalogue display. */
export function descriptionFromGutenbergSummary(
  summaries: string[] | null | undefined,
): string | null {
  const raw = summaries?.[0]?.trim();
  if (!raw) return null;
  return normalizeGutenbergSummaryText(raw);
}

export type GutendexBookSnapshot = {
  subjects: string[];
  summaries: string[];
};

const GUTENDEX_USER_AGENT = "NovelViz/1.0 (book-description)";

/** Fetch one Gutendex book record (subjects + summaries). */
export async function fetchGutendexBookById(
  gutenbergId: number,
): Promise<GutendexBookSnapshot | null> {
  try {
    const res = await fetch(`https://gutendex.com/books/?ids=${gutenbergId}`, {
      headers: { "User-Agent": GUTENDEX_USER_AGENT },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ subjects?: string[]; summaries?: string[] }>;
    };
    const book = data.results?.[0];
    if (!book) return null;
    return {
      subjects: book.subjects ?? [],
      summaries: book.summaries ?? [],
    };
  } catch {
    return null;
  }
}

const GUTENDEX_BATCH_MAX = 32;

/** Batch-fetch Gutendex books by Project Gutenberg id (max 32 per request). */
export async function fetchGutendexBooksByIds(
  gutenbergIds: number[],
): Promise<Map<number, GutendexBookSnapshot>> {
  const out = new Map<number, GutendexBookSnapshot>();
  const unique = [...new Set(gutenbergIds.filter((id) => Number.isFinite(id) && id > 0))];
  for (let i = 0; i < unique.length; i += GUTENDEX_BATCH_MAX) {
    const batch = unique.slice(i, i + GUTENDEX_BATCH_MAX);
    try {
      const res = await fetch(`https://gutendex.com/books/?ids=${batch.join(",")}`, {
        headers: { "User-Agent": GUTENDEX_USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: Array<{ id: number; subjects?: string[]; summaries?: string[] }>;
      };
      for (const book of data.results ?? []) {
        out.set(book.id, {
          subjects: book.subjects ?? [],
          summaries: book.summaries ?? [],
        });
      }
    } catch {
      // non-fatal per batch
    }
  }
  return out;
}
