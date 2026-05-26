/**
 * Canonical Project Gutenberg catalogue descriptions for NovelViz.
 *
 * **Best practice for all Gutenberg imports** (fetch, ingest, enrich, resolve):
 * use `resolveGutenbergCatalogDescription(gutenbergId, summaries)` — never
 * hand-roll description text or call gutenberg.org / Gutendex ad hoc.
 *
 * Order: Gutendex `summaries[0]` → scrape `gutenberg.org/ebooks/{id}` when empty
 * → then Open Library / EPUB / subject fallbacks via `pickBestDescription` at call sites.
 *
 * Scrape is throttled (`GUTENBERG_SCRAPE_DELAY_MS`), fail-soft (`[gutenberg-scrape]` logs).
 * See `docs/gutenberg-import.md`.
 */
import {
  descriptionFromGutenbergSummary,
  isGutenbergSearchChromeDescription,
  normalizeGutenbergSummaryText,
  stripHtmlToPlainText,
} from "@/lib/book-description";

export const GUTENBERG_SCRAPE_LOG_PREFIX = "[gutenberg-scrape]";
export const GUTENBERG_SCRAPE_DELAY_MS = 400;

const AUTO_SUMMARY_MARKER = /\(This is an automatically generated summary\.\)/i;
const GUTENBERG_SCRAPE_USER_AGENT = "NovelViz/1.0 (gutenberg-scrape)";
const SUMMARY_TEXT_CONTAINER_RE =
  /<div[^>]*\bsummary-text-container\b[^>]*>([\s\S]*?)<\/div>/i;

export function gutenbergEbookPageUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/ebooks/${gutenbergId}`;
}

function acceptParsedSummary(raw: string): string | null {
  const normalized = normalizeGutenbergSummaryText(stripHtmlToPlainText(raw));
  if (!normalized || isGutenbergSearchChromeDescription(normalized)) return null;
  return normalized;
}

/** Current PG layout: top-of-page summary in `.summary-text-container`. */
function parseSummaryFromTextContainer(html: string): string | null {
  const match = SUMMARY_TEXT_CONTAINER_RE.exec(html);
  if (!match?.[1]) return null;
  return acceptParsedSummary(match[1]);
}

/** Legacy `<p>…(auto-generated summary.)</p>` and marker-adjacent HTML fallbacks. */
function parseSummaryAroundAutoSummaryMarker(html: string): string | null {
  const markerMatch = AUTO_SUMMARY_MARKER.exec(html);
  if (!markerMatch) return null;

  const markerIndex = markerMatch.index;
  const markerEnd = markerIndex + markerMatch[0].length;
  const before = html.slice(0, markerIndex);

  const pStart = before.lastIndexOf("<p");
  const pEnd = html.indexOf("</p>", markerIndex);
  if (pStart >= 0 && pEnd >= 0) {
    const accepted = acceptParsedSummary(html.slice(pStart, pEnd + 4));
    if (accepted) return accepted;
  }

  const containerIdx = before.lastIndexOf("summary-text-container");
  let start = 0;
  if (containerIdx >= 0) {
    const gt = before.indexOf(">", containerIdx);
    start = gt >= 0 ? gt + 1 : containerIdx;
  } else {
    const quote = before.lastIndexOf('"');
    if (quote >= 0 && markerIndex - quote < 8000) start = quote;
  }

  const divEnd = html.indexOf("</div>", markerEnd);
  const end = divEnd >= 0 ? divEnd : markerEnd;
  return acceptParsedSummary(html.slice(start, end));
}

/**
 * Extract the auto-generated summary from a Gutenberg ebook HTML page.
 * Returns plain text with the trailing "(This is an automatically generated summary.)" removed.
 */
export function parseAutoSummaryFromGutenbergPageHtml(html: string): string | null {
  return (
    parseSummaryFromTextContainer(html) ??
    parseSummaryAroundAutoSummaryMarker(html) ??
    (() => {
      const paragraphRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let match: RegExpExecArray | null;
      while ((match = paragraphRe.exec(html)) !== null) {
        const inner = match[1] ?? "";
        if (!AUTO_SUMMARY_MARKER.test(inner)) continue;
        const accepted = acceptParsedSummary(inner);
        if (accepted) return accepted;
      }
      return null;
    })()
  );
}

/**
 * Pull a catalogue summary out of a corrupted full-page scrape already stored on Book.description.
 * Used when gutenberg.org scrape succeeds in DB but Gutendex is empty and re-fetch is not needed.
 */
export function extractSummaryFromCorruptedPgDescription(
  description: string | null | undefined,
): string | null {
  if (!isGutenbergSearchChromeDescription(description)) return null;
  const plain = stripHtmlToPlainText(description ?? "");
  const markerMatch = AUTO_SUMMARY_MARKER.exec(plain);
  if (!markerMatch) return null;

  const markerIndex = markerMatch.index;
  const before = plain.slice(0, markerIndex);
  const quote = before.lastIndexOf('"');
  const start = quote >= 0 && markerIndex - quote < 8000 ? quote : 0;
  return acceptParsedSummary(plain.slice(start, markerIndex + markerMatch[0].length));
}

function logScrapeError(message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.error(GUTENBERG_SCRAPE_LOG_PREFIX, message, detail);
  } else {
    console.error(GUTENBERG_SCRAPE_LOG_PREFIX, message);
  }
}

/** Fetch and parse gutenberg.org/ebooks/[id]; never throws. */
export async function fetchGutenbergPageSummary(
  gutenbergId: number,
): Promise<string | null> {
  if (!Number.isFinite(gutenbergId) || gutenbergId <= 0) {
    logScrapeError(`Invalid gutenbergId: ${gutenbergId}`);
    return null;
  }

  const url = gutenbergEbookPageUrl(gutenbergId);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": GUTENBERG_SCRAPE_USER_AGENT },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      logScrapeError(`HTTP ${res.status} for ${url}`);
      return null;
    }
    const html = await res.text();
    const parsed = parseAutoSummaryFromGutenbergPageHtml(html);
    if (!parsed) {
      logScrapeError(`No auto-summary paragraph found for ${url}`);
    }
    return parsed;
  } catch (err) {
    logScrapeError(`Fetch failed for ${url}`, err);
    return null;
  }
}

/**
 * Gutendex summaries[0], then gutenberg.org ebook page scrape.
 * Fail-soft: returns null when neither source yields usable text.
 */
export async function resolveGutenbergCatalogDescription(
  gutenbergId: number,
  summaries?: string[] | null,
  options?: { corruptedDescription?: string | null },
): Promise<string | null> {
  const fromGutendex = descriptionFromGutenbergSummary(summaries);
  if (fromGutendex) return fromGutendex;
  const scraped = await fetchGutenbergPageSummary(gutenbergId);
  if (scraped) return scraped;
  return extractSummaryFromCorruptedPgDescription(options?.corruptedDescription);
}
