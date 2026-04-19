import { AdminBooksClient, type AdminBookRow } from "./admin-books-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminBooksPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const rows = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { chapters: true } },
    },
  });

  const createdAtFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const books: AdminBookRow[] = rows.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverImageUrl: b.coverImageUrl,
    status: b.status,
    createdAtLabel: createdAtFormatter.format(b.createdAt),
    chapterCount: b._count.chapters,
  }));

  return <AdminBooksClient books={books} />;
}
