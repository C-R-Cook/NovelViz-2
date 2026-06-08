import { DiscoverCatalogueClient } from "./discover/discover-catalogue-client";
import { getDiscoverFeaturedBooks } from "@/lib/discover-catalogue";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DiscoverCatalogueRoot() {
  const user = await getCurrentUser();

  const [featured, allBooks] = await Promise.all([
    getDiscoverFeaturedBooks(user?.id ?? null),
    prisma.book.findMany({
      where: {
        status: "published",
        deletedAt: null,
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        author: true,
        genre: true,
        coverImageUrl: true,
        _count: { select: { userBooks: true } },
      },
    }),
  ]);

  const featuredIds = featured.map((b) => b.id);
  const inLibraryRows =
    user && featuredIds.length > 0
      ? await prisma.userBook.findMany({
          where: { userId: user.id, bookId: { in: featuredIds }, isActive: true },
          select: { bookId: true },
        })
      : [];
  const inLibrarySet = new Set(inLibraryRows.map((r) => r.bookId));
  const featuredLibrary = featured.map((b) => ({
    bookId: b.id,
    inLibrary: inLibrarySet.has(b.id),
  }));

  return (
    <DiscoverCatalogueClient
      featured={featured}
      allBooks={allBooks.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        coverImageUrl: book.coverImageUrl ?? "",
        readerCount: book._count.userBooks,
      }))}
      featuredLibrary={featuredLibrary}
      isLoggedIn={user !== null}
    />
  );
}
