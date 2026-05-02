import { BookCatalogue } from "./book-catalogue";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Discover | NovelViz",
};

export default async function DiscoverPage() {
  const books = await prisma.book.findMany({
    where: { status: "published", deletedAt: null },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      genre: true,
      coverImageUrl: true,
    },
  });

  return <BookCatalogue books={books} />;
}
