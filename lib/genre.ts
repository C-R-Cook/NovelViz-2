export const GENRE_LABELS: Record<string, string> = {
  fantasy: "Fantasy",
  horror: "Horror",
  romance: "Romance",
  adventure: "Adventure",
  mystery: "Mystery",
  science_fiction: "Science Fiction",
  historical_fiction: "Historical Fiction",
  literary_fiction: "Literary Fiction",
  thriller: "Thriller",
  childrens_fiction: "Children's Fiction",
  classic_literature: "Classic Literature",
  gothic: "Gothic",
  crime: "Crime",
  biography: "Biography",
  short_stories: "Short Stories",
};

export function formatGenre(genre: string | null | undefined): string {
  if (!genre) return "Unknown";
  return (
    GENRE_LABELS[genre] ??
    genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export const GENRE_OPTIONS = Object.entries(GENRE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
