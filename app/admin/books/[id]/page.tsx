import { AdminBookDetailClient } from "./admin-book-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBookDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const row = await prisma.book.findUnique({
    where: { id },
    include: {
      _count: { select: { chapters: true } },
    },
  });

  if (!row) {
    notFound();
  }

  const book = {
    id: row.id,
    title: row.title,
    author: row.author,
    genre: row.genre,
    publishedYear: row.publishedYear,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    chapterCount: row._count.chapters,
  };

  return (
    <div className="space-y-8">
      <Link
        href="/admin/books"
        className="inline-flex text-sm font-medium text-zinc-400 transition hover:text-amber-200/90"
      >
        ← Back to books
      </Link>
      <AdminBookDetailClient book={book} />
    </div>
  );
}
