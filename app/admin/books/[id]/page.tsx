// TODO: deprecated — functionality moved to /dashboard tabs
import { AdminBookDetailClient } from "./admin-book-detail-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CommentStatus } from "@db";
import { safeAdminReturnTo } from "@/lib/admin-book-navigation";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminBookDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const sp = await searchParams;
  const returnTo = safeAdminReturnTo(sp.returnTo);
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

  const publicImagesRows = await prisma.generatedImage.findMany({
    where: { bookId: id, isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      imageUrl: true,
      chapterNumberAtTime: true,
      userPrompt: true,
      isFeatured: true,
      user: { select: { username: true, name: true } },
      featureRequest: { select: { id: true, status: true } },
    },
  });

  const imageIds = publicImagesRows.map((r) => r.id);
  const hiddenCommentGroups =
    imageIds.length > 0
      ? await prisma.comment.groupBy({
          by: ["imageId"],
          where: {
            imageId: { in: imageIds },
            status: CommentStatus.HIDDEN_SPOILER,
            spoilerModerationAt: null,
          },
          _count: { _all: true },
        })
      : [];
  const hiddenByImage = new Map(hiddenCommentGroups.map((g) => [g.imageId, g._count._all]));

  const publicImages = publicImagesRows.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    chapterNumberAtTime: img.chapterNumberAtTime,
    userPrompt: img.userPrompt,
    isFeatured: img.isFeatured,
    username: img.user.username ?? img.user.name ?? "",
    featureRequest: img.featureRequest,
    hiddenSpoilerCommentCount: hiddenByImage.get(img.id) ?? 0,
  }));

  const book = {
    id: row.id,
    title: row.title,
    author: row.author,
    genre: row.genre,
    publishedYear: row.publishedYear,
    openLibraryKey: row.openLibraryKey,
    gutenbergId: row.gutenbergId,
    description: row.description,
    internalNotes: row.internalNotes ?? null,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    rejectionReason: row.rejectionReason ?? null,
    listingPreferenceAfterReview: row.listingPreferenceAfterReview ?? null,
    ownerLabel: row.owner ? (row.owner.name ?? row.owner.email) : null,
    chapterCount: row._count.chapters,
    featuredTargetAgeRanges: row.featuredTargetAgeRanges,
    featuredTargetGenders: row.featuredTargetGenders,
    featuredTargetCountries: row.featuredTargetCountries,
    featuredTargetGenres: row.featuredTargetGenres,
    createdAtLabel: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(row.createdAt),
  };

  return (
    <div className="space-y-8">
      <Link
        href={returnTo}
        className="inline-flex text-sm font-medium text-text-secondary transition hover:text-accent-text/90"
      >
        ← Back to books
      </Link>
      <AdminBookDetailClient book={book} publicImages={publicImages} returnTo={returnTo} />
    </div>
  );
}
