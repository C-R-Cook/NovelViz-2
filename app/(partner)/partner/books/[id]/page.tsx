import { PartnerBookDetailClient, type PartnerBookDetailModel } from "./partner-book-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ openCoverAi?: string }>;
};

export default async function PartnerBookDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const sp = await searchParams;
  const openCoverAiOnLoad = sp.openCoverAi === "1";
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

  const publicImageRows = await prisma.generatedImage.findMany({
    where: { bookId: id, isPublic: true },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true, name: true } },
      featureRequest: { select: { id: true, status: true } },
    },
  });

  const publicImages = publicImageRows.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    chapterNumberAtTime: img.chapterNumberAtTime,
    userPrompt: img.userPrompt,
    isFeatured: img.isFeatured,
    username: img.user.username ?? img.user.name ?? "",
    featureRequest: img.featureRequest,
  }));

  const model: PartnerBookDetailModel = {
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    publishedYear: book.publishedYear,
    description: book.description,
    internalNotes: book.internalNotes ?? null,
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
      <PartnerBookDetailClient
        book={model}
        publicImages={publicImages}
        openCoverAiOnLoad={openCoverAiOnLoad}
      />
    </div>
  );
}
