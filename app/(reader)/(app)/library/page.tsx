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
    where: {
      userId: dbUser.id,
      isActive: true,
      book: { deletedAt: null },
    },
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
    removedFromCatalogue: ub.book.status === "unlisted",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          My Library
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Books you have added. Open a title to set your chapter, ask questions, or
          generate images.
        </p>
      </div>

      {books.length === 0 ? (
        <div className="mx-auto max-w-lg py-16 text-center">
          <p className="font-serif text-xl text-text-primary">
            You haven&apos;t added any books yet
          </p>
          <p className="mt-3 text-sm text-text-muted">
            Browse the catalogue and add titles you own in the real world.
          </p>
          <Link
            href="/discover"
            className="mt-6 inline-flex rounded-lg border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/70 hover:bg-accent-muted"
          >
            Discover books
          </Link>
        </div>
      ) : (
        <BookCardGrid books={books} />
      )}
    </div>
  );
}
