"use client";

import { formatGenre, GENRE_LABELS } from "@/lib/genre";

type Props = {
  genres: string[];
  selected: string | null;
  onSelect: (genre: string | null) => void;
};

export function GalleryGenrePills({ genres, selected, onSelect }: Props) {
  const sorted = [...new Set(genres.filter(Boolean))].sort((a, b) => {
    const la = GENRE_LABELS[a] ?? a;
    const lb = GENRE_LABELS[b] ?? b;
    return la.localeCompare(lb);
  });

  if (sorted.length === 0) return null;

  return (
    <div className="gallery-genre-pills mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        className={`gallery-genre-pill shrink-0 ${selected === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {sorted.map((genre) => (
        <button
          key={genre}
          type="button"
          className={`gallery-genre-pill shrink-0 ${selected === genre ? "active" : ""}`}
          onClick={() => onSelect(genre)}
        >
          {formatGenre(genre)}
        </button>
      ))}
    </div>
  );
}
