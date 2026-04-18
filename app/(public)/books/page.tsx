import { BookCatalogue } from "./book-catalogue";
import { prisma } from "@/lib/prisma";

export default async function BooksCataloguePage() {
  const books = await prisma.book.findMany({
    where: { status: "published" },
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
