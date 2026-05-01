import { BookLibraryActions } from "../book-library-actions";
import { getCurrentUser } from "@/lib/auth";
import { formatGenre } from "@/lib/genre";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookDetailPage({ params }: PageProps) {
  const { id } = await params;

  const book = await prisma.book.findFirst({
    where: { id, status: "published", deletedAt: null },
    include: {
      _count: { select: { chapters: true } },
    },
  });

  if (!book) {
    notFound();
  }

  const chapterCount = book._count.chapters;

  const session = await getCurrentUser();
  let initialInLibrary = false;
  let readerCta: "continue" | "start" | null = null;
  if (session) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: session.clerkId },
    });
    if (dbUser) {
      const ub = await prisma.userBook.findFirst({
        where: {
          userId: dbUser.id,
          bookId: book.id,
          isActive: true,
        },
      });
      initialInLibrary = !!ub;

      const progress = await prisma.readingProgress.findUnique({
        where: {
          userId_bookId: { userId: dbUser.id, bookId: book.id },
        },
      });
      readerCta = progress ? "continue" : "start";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-9">
      <Link
        href="/books"
        className="inline-flex text-xs font-medium text-zinc-600 transition hover:text-amber-800 sm:text-sm dark:text-zinc-500 dark:hover:text-amber-200/90"
      >
        ← Back to catalogue
      </Link>

      <div className="mt-5 flex flex-row items-start gap-3.5 rounded-lg border border-zinc-200/95 bg-white p-2.5 shadow-sm shadow-zinc-900/5 dark:border-zinc-800/90 dark:bg-zinc-900/50 dark:shadow-black/20 sm:mt-6 sm:gap-5 sm:p-3">
        <div className="relative aspect-[2/3] w-[4.25rem] shrink-0 overflow-hidden rounded-sm border border-zinc-200/90 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 sm:w-36 md:w-40">
          {book.coverImageUrl ? (
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              className="object-contain object-center"
              priority
              sizes="(max-width: 640px) 68px, (max-width: 768px) 144px, 160px"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight text-zinc-500 dark:text-zinc-600">
              No cover
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
          {book.genre ? (
            <span className="inline-flex rounded border border-amber-700/35 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900/90 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-200/85">
              {formatGenre(book.genre)}
            </span>
          ) : null}

          <div>
            <h1 className="font-serif text-lg font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl md:text-[1.65rem]">
              {book.title}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">{book.author}</p>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-500 sm:gap-x-6 sm:text-sm">
            {book.publishedYear != null ? (
              <div>
                <dt className="text-zinc-500 dark:text-zinc-600">First published</dt>
                <dd className="font-medium text-zinc-800 dark:text-zinc-300">{book.publishedYear}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500 dark:text-zinc-600">Chapters</dt>
              <dd className="font-medium text-zinc-800 dark:text-zinc-300">{chapterCount}</dd>
            </div>
            {book.isPublicDomain ? (
              <div>
                <dt className="text-zinc-500 dark:text-zinc-600">Rights</dt>
                <dd className="font-medium text-zinc-800 dark:text-zinc-300">Public domain</dd>
              </div>
            ) : null}
          </dl>

          {book.description ? (
            <div className="border-t border-zinc-200/80 pt-2.5 dark:border-zinc-800/80 sm:pt-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 sm:text-xs">
                About
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-sm sm:leading-relaxed">
                {book.description}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <BookLibraryActions
              bookId={book.id}
              initialInLibrary={initialInLibrary}
              isLoggedIn={!!session}
            />
            {session && readerCta ? (
              <Link
                href={`/reader/${book.id}`}
                className="inline-flex w-fit rounded-md border border-amber-700/50 bg-amber-100/90 px-3 py-2 text-xs font-medium text-amber-950 transition hover:border-amber-600/70 hover:bg-amber-200/90 sm:px-4 sm:text-sm dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:border-amber-600/60 dark:hover:bg-amber-950/50"
              >
                {readerCta === "continue" ? "Continue Reading" : "Start Reading"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
