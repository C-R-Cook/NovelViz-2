import { DiscoverCatalogueClient } from "./discover/discover-catalogue-client";
import { getDiscoverFeaturedBooks } from "@/lib/discover-catalogue";
import { prisma } from "@/lib/prisma";

export async function DiscoverCatalogueRoot() {
  const [featured, allBooks] = await Promise.all([
    getDiscoverFeaturedBooks(),
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
      },
    }),
  ]);

  return (
    <DiscoverCatalogueClient
      featured={featured}
      allBooks={allBooks.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        coverImageUrl: book.coverImageUrl ?? "",
      }))}
    />
  );
}
