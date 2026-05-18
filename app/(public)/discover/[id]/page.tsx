import { BookLibraryActions } from "../book-library-actions";
import { getCurrentUser } from "@/lib/auth";
import { getPublishedDiscoverBookById } from "@/lib/discover-published-book";
import { formatGenre } from "@/lib/genre";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function truncateForMeta(text: string | null, max = 155): string | undefined {
  if (!text?.trim()) return undefined;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const book = await getPublishedDiscoverBookById(id);
  if (!book) {
    notFound();
  }

  const title = `${book.title} · ${book.author} | NovelViz`;
  const description = truncateForMeta(book.description);

  return {
    title,
    description,
    openGraph: {
      title: `${book.title} · ${book.author}`,
      description,
      type: "article",
      ...(book.coverImageUrl
        ? { images: [{ url: book.coverImageUrl, alt: book.title }] }
        : {}),
    },
  };
}

export default async function DiscoverBookDetailPage({ params }: PageProps) {
  const { id } = await params;

  const book = await getPublishedDiscoverBookById(id);

  if (!book) {
    notFound();
  }

  const chapterCount = book._count.chapters;
  const publicImageCount = await prisma.generatedImage.count({
    where: { bookId: book.id, isPublic: true },
  });

  const session = await getCurrentUser();
  let initialInLibrary = false;
  let readerCta: "continue" | "start" | null = null;
  if (session) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: session.clerkId },
    });
    if (dbUser) {
      const ub = await prisma.userBook.findFirst({
        where: {
          userId: dbUser.id,
          bookId: book.id,
          isActive: true,
        },
      });
      initialInLibrary = !!ub;

      const progress = await prisma.readingProgress.findUnique({
        where: {
          userId_bookId: { userId: dbUser.id, bookId: book.id },
        },
      });
      readerCta = progress ? "continue" : "start";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-9">
      <Link
        href="/discover"
        className="inline-flex text-xs font-medium text-text-muted transition hover:text-accent-text sm:text-sm"
      >
        ← Back to discover
      </Link>

      <div className="mt-5 flex flex-row items-start gap-3.5 rounded-lg border border-border/95 bg-bg-surface p-2.5 shadow-sm shadow-bg-overlay/5 sm:mt-6 sm:gap-5 sm:p-3">
        <div className="relative aspect-[2/3] w-[4.25rem] shrink-0 overflow-hidden rounded-sm border border-border bg-bg-surface sm:w-36 md:w-40">
          {book.coverImageUrl ? (
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              className="object-contain object-center"
              priority
              sizes="(max-width: 640px) 68px, (max-width: 768px) 144px, 160px"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight text-text-muted">
              No cover
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
          {book.genre ? (
            <span className="inline-flex rounded border border-accent/35 bg-accent-muted/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-text/90">
              {formatGenre(book.genre)}
            </span>
          ) : null}

          <div>
            <h1 className="font-serif text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl md:text-[1.65rem]">
              {book.title}
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary sm:text-base">{book.author}</p>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted sm:gap-x-6 sm:text-sm">
            {book.publishedYear != null ? (
              <div>
                <dt className="text-text-muted">First published</dt>
                <dd className="font-medium text-text-primary">{book.publishedYear}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-muted">Chapters</dt>
              <dd className="font-medium text-text-primary">{chapterCount}</dd>
            </div>
            {book.isPublicDomain ? (
              <div>
                <dt className="text-text-muted">Rights</dt>
                <dd className="font-medium text-text-primary">Public domain</dd>
              </div>
            ) : null}
          </dl>

          {book.description ? (
            <div className="border-t border-border/80 pt-2.5 sm:pt-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:text-xs">
                About
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary sm:text-sm sm:leading-relaxed">
                {book.description}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <BookLibraryActions
              bookId={book.id}
              initialInLibrary={initialInLibrary}
              isLoggedIn={!!session}
            />
            {session && readerCta ? (
              <Link
                href={`/library?book=${book.id}`}
                className="inline-flex w-fit rounded-md border border-accent/35 bg-accent-muted px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent/70 hover:bg-accent-hover/90 sm:px-4 sm:text-sm"
              >
                {readerCta === "continue" ? "Continue Reading" : "Start Reading"}
              </Link>
            ) : null}
            {publicImageCount > 0 ? (
              <Link
                href={`/gallery/${book.id}`}
                className="inline-flex w-fit rounded-md border border-accent/35 bg-accent-muted px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent/70 hover:bg-accent-hover/90 sm:px-4 sm:text-sm"
              >
                View community images ({publicImageCount} {publicImageCount === 1 ? "image" : "images"}) →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
