import Image from "next/image";
import Link from "next/link";
import { formatGenre } from "@/lib/genre";

export type CatalogueBook = {
  id: string;
  title: string;
  author: string;
  description: string | null;
  genre: string | null;
  coverImageUrl: string | null;
  /** When set (e.g. My Library), the card links to `/reader/[id]` instead of the catalogue detail page. */
  readerAction?: "continue" | "start";
  /**
   * My Library: book status is no longer publicly listed (`unlisted`).
   * Card stays visible but is not clickable, greyed out, with a message over the cover.
   */
  removedFromCatalogue?: boolean;
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
      {books.map((book) => {
        const primaryHref = book.readerAction ? `/reader/${book.id}` : `/discover/${book.id}`;
        const shelvedUnavailable = Boolean(book.removedFromCatalogue);
        const hoverCardClass =
          shelvedUnavailable
            ? ""
            : isRow
              ? "hover:border-amber-500/50 dark:hover:border-amber-800/45"
              : "hover:scale-[1.02] hover:border-amber-500/60 hover:shadow-lg hover:shadow-zinc-900/15 dark:hover:border-amber-800/50 dark:hover:shadow-black/30";
        const hoverLinkClass =
          shelvedUnavailable || isRow ? "" : "hover:scale-[1.01] sm:hover:scale-[1.02]";

        const cover = (
          <div
            className={`relative shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${
              shelvedUnavailable ? "opacity-70 grayscale" : ""
            } ${
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
            {shelvedUnavailable ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/75 px-1.5 py-2 backdrop-blur-[1px]">
                <p className="text-center text-[9px] font-semibold uppercase leading-snug tracking-wide text-white sm:text-[10px]">
                  Removed from the catalogue
                </p>
              </div>
            ) : null}
          </div>
        );

        const details = (
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${shelvedUnavailable ? "opacity-60" : ""} ${
              isRow ? "gap-0.5 py-0.5" : "gap-1.5 p-2.5"
            }`}
          >
            <h2
              className={`font-serif font-semibold leading-snug text-zinc-900 dark:text-zinc-100 ${
                !shelvedUnavailable
                  ? "group-hover:text-amber-900 dark:group-hover:text-amber-100/95"
                  : ""
              } ${
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
                {formatGenre(book.genre)}
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
        );

        const innerClass = `group flex min-h-0 min-w-0 flex-1 text-left ${hoverLinkClass} ${
          isRow ? "flex-row gap-3 p-2.5 sm:gap-3.5 sm:p-3" : "min-h-0 flex-1 flex-col"
        }`;

        return (
          <li key={book.id} className={isRow ? "" : "h-full"}>
            <div
              className={`flex overflow-hidden rounded-lg border border-zinc-200/95 bg-white shadow-sm shadow-zinc-900/5 transition duration-200 dark:border-zinc-800/90 dark:bg-zinc-900/50 dark:shadow-black/20 ${hoverCardClass} ${
                shelvedUnavailable ? "opacity-90" : ""
              } ${
                isRow
                  ? "flex-row items-stretch"
                  : `h-full flex-col shadow-md shadow-zinc-900/10 dark:shadow-black/25`
              }`}
            >
              {!shelvedUnavailable ? (
                <Link href={primaryHref} className={innerClass}>
                  {cover}
                  {details}
                </Link>
              ) : (
                <div
                  className={`${innerClass} cursor-not-allowed select-none`}
                  aria-disabled="true"
                  aria-label={`${book.title}: removed from the catalogue, not currently readable`}
                  title="Removed from the catalogue"
                >
                  {cover}
                  {details}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
