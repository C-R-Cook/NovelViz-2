"use client";

import { BookCardGrid } from "@/components/book-card-grid";
import type { CatalogueBook } from "@/components/book-card-grid";
import { useMemo, useState } from "react";

export type { CatalogueBook };

type Props = {
  books: CatalogueBook[];
};

export function BookCatalogue({ books }: Props) {
  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      if (b.genre) set.add(b.genre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const [genre, setGenre] = useState<string>("all");

  const filtered = useMemo(() => {
    if (genre === "all") return books;
    return books.filter((b) => b.genre === genre);
  }, [books, genre]);

  if (books.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="font-serif text-2xl text-zinc-200">No books yet</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          The catalogue is empty. When titles are published, they will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Catalogue
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Public-domain works ready for your library. Filter by genre or browse
            the full list.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label
            htmlFor="genre-filter"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Genre
          </label>
          <select
            id="genre-filter"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 shadow-inner outline-none ring-amber-500/30 transition focus:border-amber-600/50 focus:ring-2 sm:w-auto"
          >
            <option value="all">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          No books in this genre. Try another filter.
        </p>
      ) : (
        <BookCardGrid books={filtered} />
      )}
    </div>
  );
}
