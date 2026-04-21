import Image from "next/image";
import Link from "next/link";

export type CatalogueBook = {
  id: string;
  title: string;
  author: string;
  description: string | null;
  genre: string | null;
  coverImageUrl: string | null;
  /** When set, show a link to the reader for this book (e.g. library) */
  readerAction?: "continue" | "start";
};

type Props = {
  books: CatalogueBook[];
};

export function BookCardGrid({ books }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {books.map((book) => (
        <li key={book.id} className="h-full">
          <div
            className={`flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200/95 bg-white shadow-md shadow-zinc-900/10 transition duration-200 dark:border-zinc-800/90 dark:bg-zinc-900/50 dark:shadow-black/25 ${
              !book.readerAction
                ? "hover:scale-[1.02] hover:border-amber-500/60 hover:shadow-lg hover:shadow-zinc-900/15 dark:hover:border-amber-800/50 dark:hover:shadow-black/30"
                : ""
            }`}
          >
            <Link
              href={`/books/${book.id}`}
              className="group flex min-h-0 flex-1 flex-col hover:scale-[1.01] sm:hover:scale-[1.02]"
            >
              <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {book.coverImageUrl ? (
                  <Image
                    src={book.coverImageUrl}
                    alt={book.title}
                    fill
                    className="object-contain object-center"
                    sizes="(max-width: 639px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-zinc-500 dark:text-zinc-600">
                    No cover
                  </div>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
                <h2 className="truncate font-serif text-sm font-bold leading-tight text-zinc-900 group-hover:text-amber-900 dark:text-zinc-100 dark:group-hover:text-amber-100/95">
                  {book.title}
                </h2>
                <p className="truncate text-xs text-zinc-600 dark:text-zinc-500">{book.author}</p>
                {book.genre ? (
                  <span className="inline-flex w-fit max-w-full truncate rounded border border-amber-700/40 bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900/90 dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-200/85">
                    {book.genre}
                  </span>
                ) : null}
                {book.description ? (
                  <p className="line-clamp-2 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                    {book.description}
                  </p>
                ) : null}
              </div>
            </Link>
            {book.readerAction ? (
              <div className="border-t border-zinc-200/90 p-2 dark:border-zinc-800/80">
                <Link
                  href={`/reader/${book.id}`}
                  className="block w-full rounded-md bg-amber-100/90 py-1.5 text-center text-xs font-medium text-amber-950 transition hover:bg-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100/95 dark:hover:bg-amber-950/60"
                >
                  {book.readerAction === "continue" ? "Continue Reading" : "Start Reading"}
                </Link>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
