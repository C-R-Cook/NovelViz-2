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
  /** Row list: cover on the left, details in a column on the right (catalogue). */
  layout?: "grid" | "row";
};

export function BookCardGrid({ books, layout = "grid" }: Props) {
  const isRow = layout === "row";

  return (
    <ul
      className={
        isRow
          ? "flex flex-col gap-2"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
      }
    >
      {books.map((book) => (
        <li key={book.id} className={isRow ? "" : "h-full"}>
          <div
            className={`flex overflow-hidden rounded-lg border border-zinc-200/95 bg-white shadow-sm shadow-zinc-900/5 transition duration-200 dark:border-zinc-800/90 dark:bg-zinc-900/50 dark:shadow-black/20 ${
              isRow
                ? "flex-row items-stretch hover:border-amber-500/50 dark:hover:border-amber-800/45"
                : `h-full flex-col shadow-md shadow-zinc-900/10 dark:shadow-black/25 ${
                    !book.readerAction
                      ? "hover:scale-[1.02] hover:border-amber-500/60 hover:shadow-lg hover:shadow-zinc-900/15 dark:hover:border-amber-800/50 dark:hover:shadow-black/30"
                      : ""
                  }`
            }`}
          >
            <Link
              href={`/books/${book.id}`}
              className={`group flex min-h-0 min-w-0 flex-1 text-left ${
                isRow
                  ? "flex-row gap-3 p-2.5 sm:gap-3.5 sm:p-3"
                  : "min-h-0 flex-1 flex-col hover:scale-[1.01] sm:hover:scale-[1.02]"
              }`}
            >
              <div
                className={`relative shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${
                  isRow
                    ? "aspect-[2/3] w-[4.25rem] self-start rounded-sm sm:w-24"
                    : "aspect-[2/3] w-full"
                }`}
              >
                {book.coverImageUrl ? (
                  <Image
                    src={book.coverImageUrl}
                    alt={book.title}
                    fill
                    className="object-contain object-center"
                    sizes={
                      isRow
                        ? "(max-width: 640px) 68px, 96px"
                        : "(max-width: 639px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight text-zinc-500 dark:text-zinc-600">
                    No cover
                  </div>
                )}
              </div>
              <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                  isRow ? "gap-0.5 py-0.5" : "gap-1.5 p-2.5"
                }`}
              >
                <h2
                  className={`font-serif font-semibold leading-snug text-zinc-900 group-hover:text-amber-900 dark:text-zinc-100 dark:group-hover:text-amber-100/95 ${
                    isRow
                      ? "line-clamp-2 text-sm sm:text-[0.9375rem]"
                      : "truncate text-sm font-bold leading-tight"
                  }`}
                >
                  {book.title}
                </h2>
                <p
                  className={`text-zinc-600 dark:text-zinc-500 ${
                    isRow ? "line-clamp-1 text-xs" : "truncate text-xs"
                  }`}
                >
                  {book.author}
                </p>
                {book.genre ? (
                  <span className="mt-0.5 inline-flex w-fit max-w-full truncate rounded border border-amber-700/35 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900/90 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-200/85">
                    {book.genre}
                  </span>
                ) : null}
                {book.description ? (
                  <p
                    className={`text-xs leading-snug text-zinc-600 dark:text-zinc-400 ${
                      isRow ? "mt-1 line-clamp-2 sm:line-clamp-3" : "line-clamp-2"
                    }`}
                  >
                    {book.description}
                  </p>
                ) : null}
              </div>
            </Link>
            {book.readerAction ? (
              <div
                className={
                  isRow
                    ? "flex shrink-0 flex-col justify-center border-l border-zinc-200/90 px-2.5 py-2 dark:border-zinc-800/80 sm:px-3"
                    : "border-t border-zinc-200/90 p-2 dark:border-zinc-800/80"
                }
              >
                <Link
                  href={`/reader/${book.id}`}
                  className={
                    isRow
                      ? "whitespace-nowrap rounded-md bg-amber-100/90 px-2.5 py-1.5 text-center text-[11px] font-medium text-amber-950 transition hover:bg-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100/95 dark:hover:bg-amber-950/60 sm:px-3 sm:text-xs"
                      : "block w-full rounded-md bg-amber-100/90 py-1.5 text-center text-xs font-medium text-amber-950 transition hover:bg-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100/95 dark:hover:bg-amber-950/60"
                  }
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
