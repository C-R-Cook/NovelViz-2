import { AGE_RANGES, GENDERS, GENRE_OPTIONS } from "@/lib/user-profile-options";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const VALID_AGE = new Set(AGE_RANGES.map((o) => o.value));
const VALID_GENDER = new Set(GENDERS.map((o) => o.value));
const VALID_GENRE = new Set(GENRE_OPTIONS.map((o) => o.value));
const VALID_COUNTRY = new Set(Object.keys(countries.getNames("en", { select: "official" })));

export type BookTargetingPayload = {
  featuredTargetAgeRanges: string[];
  featuredTargetGenders: string[];
  featuredTargetCountries: string[];
  featuredTargetGenres: string[];
};

function validateStringArray(
  value: unknown,
  field: string,
  allowed: Set<string>,
): string[] | { error: string } {
  if (!Array.isArray(value)) return { error: `${field} must be an array` };
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item)) {
      return { error: `Invalid value in ${field}` };
    }
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function parseBookTargetingBody(body: unknown): BookTargetingPayload | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid JSON body" };
  const raw = body as Record<string, unknown>;

  const featuredTargetAgeRanges = validateStringArray(
    raw.featuredTargetAgeRanges,
    "featuredTargetAgeRanges",
    VALID_AGE,
  );
  if ("error" in featuredTargetAgeRanges) return featuredTargetAgeRanges;

  const featuredTargetGenders = validateStringArray(
    raw.featuredTargetGenders,
    "featuredTargetGenders",
    VALID_GENDER,
  );
  if ("error" in featuredTargetGenders) return featuredTargetGenders;

  const featuredTargetCountries = validateStringArray(
    raw.featuredTargetCountries,
    "featuredTargetCountries",
    VALID_COUNTRY,
  );
  if ("error" in featuredTargetCountries) return featuredTargetCountries;

  const featuredTargetGenres = validateStringArray(
    raw.featuredTargetGenres,
    "featuredTargetGenres",
    VALID_GENRE,
  );
  if ("error" in featuredTargetGenres) return featuredTargetGenres;

  return {
    featuredTargetAgeRanges,
    featuredTargetGenders,
    featuredTargetCountries,
    featuredTargetGenres,
  };
}

export function getEffectiveTargetGenresForBook(book: {
  genre: string | null;
  featuredTargetGenres: string[];
}): string[] {
  const base = book.genre ? [book.genre] : [];
  if (book.featuredTargetGenres.length === 0) return base;
  return [...new Set([...base, ...book.featuredTargetGenres])];
}
