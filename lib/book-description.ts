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

/** Last-resort blurb from Gutendex / queue subject tags. */
export function descriptionFromSubjects(subjects: string[]): string | null {
  if (subjects.length === 0) return null;
  const cleaned = subjects
    .slice(0, 6)
    .map((s) => s.replace(/\s*--\s*.*$/, "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return null;
  return `Public domain classic. Subjects: ${cleaned.join("; ")}.`;
}

export function gutenbergEpubNoImagesUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/ebooks/${gutenbergId}.epub.noimages`;
}
