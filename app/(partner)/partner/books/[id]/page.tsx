import { PartnerBookDetailClient, type PartnerBookDetailModel } from "./partner-book-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function PartnerBookDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const book = await prisma.book.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { chapters: true } } },
  });
  if (!book) {
    notFound();
  }
  if (book.ownerId !== dbUser.id) {
    forbidden();
  }

  const model: PartnerBookDetailModel = {
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    publishedYear: book.publishedYear,
    description: book.description,
    coverImageUrl: book.coverImageUrl,
    status: book.status,
    rejectionReason: book.rejectionReason,
    listingPreferenceAfterReview: book.listingPreferenceAfterReview,
    chapterCount: book._count.chapters,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex text-sm font-medium text-text-muted transition hover:text-accent-text"
      >
        ← Back to dashboard
      </Link>
      <PartnerBookDetailClient book={model} />
    </div>
  );
}
