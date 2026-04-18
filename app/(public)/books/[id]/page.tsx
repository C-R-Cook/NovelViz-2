import { BookLibraryActions } from "../book-library-actions";
import { getCurrentUser } from "@/lib/auth";
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
    where: { id, status: "published" },
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
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/books"
        className="inline-flex text-sm font-medium text-zinc-500 transition hover:text-amber-200/90"
      >
        ← Back to catalogue
      </Link>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="relative mx-auto w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30 lg:mx-0">
          <div className="relative aspect-[2/3] w-full">
            {book.coverImageUrl ? (
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                fill
                className="object-cover"
                priority
                sizes="280px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                No cover
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          {book.genre ? (
            <span className="inline-block rounded-full border border-amber-900/50 bg-amber-950/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-200/90">
              {book.genre}
            </span>
          ) : null}

          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {book.title}
            </h1>
            <p className="mt-2 text-lg text-zinc-400">{book.author}</p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
            {book.publishedYear != null ? (
              <div>
                <dt className="text-zinc-600">First published</dt>
                <dd className="font-medium text-zinc-300">{book.publishedYear}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-600">Chapters</dt>
              <dd className="font-medium text-zinc-300">{chapterCount}</dd>
            </div>
            {book.isPublicDomain ? (
              <div>
                <dt className="text-zinc-600">Rights</dt>
                <dd className="font-medium text-zinc-300">Public domain</dd>
              </div>
            ) : null}
          </dl>

          {book.description ? (
            <div className="border-t border-zinc-800/80 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                About
              </h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-300">
                {book.description}
              </p>
            </div>
          ) : null}

          <BookLibraryActions
            bookId={book.id}
            initialInLibrary={initialInLibrary}
            isLoggedIn={!!session}
          />
        </div>
      </div>
    </div>
  );
}
