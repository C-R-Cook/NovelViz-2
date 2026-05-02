"use client";

import { BookCardGrid } from "@/components/book-card-grid";
import { formatGenre } from "@/lib/genre";
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
    return Array.from(set).sort((a, b) => formatGenre(a).localeCompare(formatGenre(b)));
  }, [books]);

  const [genre, setGenre] = useState<string>("all");

  const filtered = useMemo(() => {
    if (genre === "all") return books;
    return books.filter((b) => b.genre === genre);
  }, [books, genre]);

  if (books.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="font-serif text-2xl text-zinc-800 dark:text-zinc-200">No books yet</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-500">
          The catalogue is empty. When titles are published, they will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-9">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Discover
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-500 sm:text-sm">
            Public-domain works ready for your library. Filter by genre or browse
            the full list.
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <label
            htmlFor="genre-filter"
            className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500"
          >
            Genre
          </label>
          <select
            id="genre-filter"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full min-w-[10rem] rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-inner outline-none ring-amber-500/20 transition focus:border-amber-600/50 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:ring-amber-500/30 sm:w-auto"
          >
            <option value="all">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {formatGenre(g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-500">
          No books in this genre. Try another filter.
        </p>
      ) : (
        <BookCardGrid books={filtered} layout="row" />
      )}
    </div>
  );
}
