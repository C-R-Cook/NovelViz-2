// TODO: deprecated — functionality moved to /dashboard tabs
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
  const row = await prisma.book.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
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
    rejectionReason: row.rejectionReason ?? null,
    listingPreferenceAfterReview: row.listingPreferenceAfterReview ?? null,
    ownerLabel: row.owner ? (row.owner.name ?? row.owner.email) : null,
    chapterCount: row._count.chapters,
    createdAtLabel: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(row.createdAt),
  };

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard?tab=for-review"
        className="inline-flex text-sm font-medium text-text-secondary transition hover:text-accent-text/90"
      >
        ← Back to books
      </Link>
      <AdminBookDetailClient book={book} />
    </div>
  );
}
