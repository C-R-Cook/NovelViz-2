import type { FilterResult } from "./gutenberg-types";

const HARD_REJECT_TERMS = [
  "medicine",
  "surgery",
  "anatomy",
  "physiology",
  "pharmacology",
  "therapeutics",
  "pathology",
  "nursing",
  "dentistry",
  "veterinary",
  "engineering",
  "mechanical",
  "electrical",
  "civil engineering",
  "hydraulics",
  "mathematics",
  "algebra",
  "geometry",
  "calculus",
  "trigonometry",
  "arithmetic",
  "law",
  "legal",
  "jurisprudence",
  "contracts",
  "statutes",
  "economics",
  "commerce",
  "accounting",
  "finance",
  "business",
  "chemistry",
  "physics",
  "thermodynamics",
  "optics",
  "magnetism",
  "electricity",
  "botany",
  "agriculture",
  "horticulture",
  "gardening",
  "farming",
  "cookery",
  "cooking",
  "recipes",
  "architecture",
  "building construction",
  "military science",
  "naval science",
  "gunnery",
  "ordnance",
  "railroads",
  "locomotives",
  "telegraphy",
  "radio",
  "technology",
  "manufacturing",
  "textile",
  "political science",
  "government documents",
  "medicine and health",
] as const;

const SOFT_REVIEW_TERMS = [
  "history",
  "historical",
  "philosophy",
  "travel",
  "voyages",
  "biography",
  "autobiography",
  "memoir",
  "essays",
  "religion",
  "theology",
  "sermons",
  "devotional",
  "folklore",
  "mythology",
  "legends",
  "poetry",
  "poems",
  "verse",
  "drama",
  "plays",
  "theatre",
] as const;

const AUTO_ACCEPT_SOFT_TERMS = new Set(["folklore", "mythology", "drama"]);

function combinedHaystack(subjects: string[], bookshelves: string[]): string {
  return [...subjects, ...bookshelves].join(" ").toLowerCase();
}

function findFirstMatch(haystack: string, terms: readonly string[]): string | null {
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

function findAllMatches(haystack: string, terms: readonly string[]): string[] {
  const found: string[] = [];
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) {
      found.push(term);
    }
  }
  return found;
}

export function classifyBook(
  subjects: string[],
  bookshelves: string[],
): {
  filterResult: FilterResult;
  rejectReason: string | null;
  reviewReasons: string[];
} {
  const haystack = combinedHaystack(subjects, bookshelves);

  const rejectReason = findFirstMatch(haystack, HARD_REJECT_TERMS);
  if (rejectReason) {
    return { filterResult: "rejected", rejectReason, reviewReasons: [] };
  }

  const reviewReasons = findAllMatches(haystack, SOFT_REVIEW_TERMS);
  if (reviewReasons.length > 0) {
    const onlyAutoAccept =
      reviewReasons.length > 0 &&
      reviewReasons.every((r) => AUTO_ACCEPT_SOFT_TERMS.has(r));
    if (onlyAutoAccept) {
      return { filterResult: "accepted", rejectReason: null, reviewReasons };
    }
    return { filterResult: "review", rejectReason: null, reviewReasons };
  }

  return { filterResult: "accepted", rejectReason: null, reviewReasons: [] };
}

export function formatAuthorDisplay(raw: string): string {
  const commaIdx = raw.indexOf(",");
  if (commaIdx === -1) return raw.trim();
  const surname = raw.slice(0, commaIdx).trim();
  const given = raw.slice(commaIdx + 1).trim();
  if (!given) return surname;
  return `${given} ${surname}`;
}

/** Gutenberg text-only EPUB (no inline illustrations). */
export function gutenbergNoImagesEpubUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/ebooks/${gutenbergId}.epub.noimages`;
}

function isIllustratedEpubUrl(url: string): boolean {
  return /\.epub3?\.images\b/i.test(url) || /\.epub\.images\b/i.test(url);
}

/**
 * Prefer the small no-images EPUB for ingest. Gutendex often lists only the large
 * illustrated EPUB3; derive the no-images URL from the Gutenberg id when needed.
 */
export function pickEpubUrl(formats: Record<string, string>, gutenbergId: number): string | null {
  const epubEntries = Object.entries(formats).filter(([mime]) => mime === "application/epub+zip");
  if (epubEntries.length === 0) return null;

  const listedNoImages = epubEntries.find(([, url]) => url.includes("noimages"));
  if (listedNoImages) return listedNoImages[1];

  const first = epubEntries[0]![1];
  if (isIllustratedEpubUrl(first)) {
    return gutenbergNoImagesEpubUrl(gutenbergId);
  }

  return first;
}

export const QUEUE_PATH = "scripts/gutenberg-queue.json";
