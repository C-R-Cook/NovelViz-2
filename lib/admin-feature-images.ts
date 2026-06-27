import { prisma } from "@/lib/prisma";
import type { FeatureRequestStatus, Prisma } from "@db";

export const ADMIN_FEATURE_IMAGES_PAGE_SIZE = 24;
export const ADMIN_FEATURE_IMAGES_TAKE_MAX = 100;

export type AdminFeatureImagesFilter = "featured" | "all" | "book" | "deidentified";

export type AdminFeatureImageRow = {
  id: string;
  imageUrl: string;
  userPrompt: string;
  chapterNumberAtTime: number;
  createdAtMs: number;
  isFeatured: boolean;
  isPublic: boolean;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverImageUrl: string | null;
  username: string;
  formerUsername: string | null;
  deidentifiedAtMs: number | null;
  featureRequest: { id: string; status: FeatureRequestStatus } | null;
};

const imageSelect = {
  id: true,
  imageUrl: true,
  userPrompt: true,
  chapterNumberAtTime: true,
  createdAt: true,
  isFeatured: true,
  isPublic: true,
  formerUsername: true,
  deidentifiedAt: true,
  book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
  user: { select: { username: true, name: true } },
  featureRequest: { select: { id: true, status: true } },
} satisfies Prisma.GeneratedImageSelect;

type ImageRow = Prisma.GeneratedImageGetPayload<{ select: typeof imageSelect }>;

function mapImageRow(img: ImageRow): AdminFeatureImageRow {
  return {
    id: img.id,
    imageUrl: img.imageUrl,
    userPrompt: img.userPrompt ?? "",
    chapterNumberAtTime: img.chapterNumberAtTime,
    createdAtMs: img.createdAt.getTime(),
    isFeatured: img.isFeatured,
    isPublic: img.isPublic,
    bookId: img.book.id,
    bookTitle: img.book.title,
    bookAuthor: img.book.author,
    bookCoverImageUrl: img.book.coverImageUrl,
    username: img.user.username ?? img.user.name ?? "",
    formerUsername: img.formerUsername,
    deidentifiedAtMs: img.deidentifiedAt?.getTime() ?? null,
    featureRequest: img.featureRequest,
  };
}

export function parseAdminFeatureImagesFilter(raw: string | null): AdminFeatureImagesFilter {
  if (raw === "featured" || raw === "book" || raw === "deidentified") return raw;
  return "all";
}

export function parseAdminFeatureImagesTake(raw: string | null, fallback = ADMIN_FEATURE_IMAGES_PAGE_SIZE): number {
  if (raw === null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, ADMIN_FEATURE_IMAGES_TAKE_MAX);
}

export async function queryAdminFeatureImagesPage(args: {
  filter: AdminFeatureImagesFilter;
  bookId?: string | null;
  skip?: number;
  take?: number;
}): Promise<{ rows: AdminFeatureImageRow[]; hasMore: boolean }> {
  const skip = Math.max(0, args.skip ?? 0);
  const take = Math.min(Math.max(1, args.take ?? ADMIN_FEATURE_IMAGES_PAGE_SIZE), ADMIN_FEATURE_IMAGES_TAKE_MAX);

  const where: Prisma.GeneratedImageWhereInput =
    args.filter === "featured"
      ? { isFeatured: true }
      : args.filter === "deidentified"
        ? { deidentifiedAt: { not: null } }
        : args.filter === "book" && args.bookId
          ? { bookId: args.bookId }
          : { isFeatured: false };

  const orderBy: Prisma.GeneratedImageOrderByWithRelationInput =
    args.filter === "deidentified"
      ? { deidentifiedAt: "desc" }
      : { createdAt: "desc" };

  const rows = await prisma.generatedImage.findMany({
    where,
    orderBy,
    skip,
    take: take + 1,
    select: imageSelect,
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { rows: page.map(mapImageRow), hasMore };
}
