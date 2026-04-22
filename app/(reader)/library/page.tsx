import { BookCardGrid } from "@/components/book-card-grid";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "My Library | NovelViz",
};

export default async function LibraryPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: session.clerkId },
  });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const userBooks = await prisma.userBook.findMany({
    where: { userId: dbUser.id, isActive: true },
    include: { book: true },
    orderBy: { addedAt: "desc" },
  });

  const bookIds = userBooks.map((ub) => ub.book.id);
  const progressRows =
    bookIds.length > 0
      ? await prisma.readingProgress.findMany({
          where: { userId: dbUser.id, bookId: { in: bookIds } },
          select: { bookId: true },
        })
      : [];
  const booksWithProgress = new Set(progressRows.map((p) => p.bookId));

  const books = userBooks.map((ub) => ({
    id: ub.book.id,
    title: ub.book.title,
    author: ub.book.author,
    description: ub.book.description,
    genre: ub.book.genre,
    coverImageUrl: ub.book.coverImageUrl,
    readerAction: (booksWithProgress.has(ub.book.id) ? "continue" : "start") as
      "continue" | "start",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          My Library
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-500">
          Books you have added. Open a title to set your chapter, ask questions, or
          generate images.
        </p>
      </div>

      {books.length === 0 ? (
        <div className="mx-auto max-w-lg py-16 text-center">
          <p className="font-serif text-xl text-zinc-800 dark:text-zinc-200">
            You haven&apos;t added any books yet
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-500">
            Browse the catalogue and add titles you own in the real world.
          </p>
          <Link
            href="/books"
            className="mt-6 inline-flex rounded-lg border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:border-amber-600/70 hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:border-amber-600/60 dark:hover:bg-amber-950/50"
          >
            Browse books
          </Link>
        </div>
      ) : (
        <BookCardGrid books={books} />
      )}
    </div>
  );
}
