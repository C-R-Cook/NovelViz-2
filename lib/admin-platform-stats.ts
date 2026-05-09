import { prisma } from "@/lib/prisma";
import type { BookStatus } from "@db";

export type BooksByStatusRow = { status: BookStatus; count: number };

export type AdminPlatformStatsPayload = {
  totalUsers: number;
  booksByStatus: BooksByStatusRow[];
  /** Non-deleted row count (sanity summary). */
  totalBooksActive: number;
  totalQueries: number;
  totalGeneratedImages: number;
  tokenTotals: {
    fromQueries: number;
    fromImages: number;
    grandTotal: number;
    /** Detailed sums for QA / troubleshooting */
    breakdown: {
      query: {
        promptTokens: number;
        completionTokens: number;
        embeddingTokens: number;
      };
      generatedImage: {
        promptTokens: number;
        completionTokens: number;
        embeddingTokens: number;
        subjectTokens: number;
      };
    };
  };
};

function nz(n: number | bigint | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === "bigint" ? Number(n) : n;
}

export async function fetchAdminPlatformStats(): Promise<AdminPlatformStatsPayload> {
  const [
    totalUsers,
    booksGrouped,
    totalBooksActive,
    totalQueries,
    totalGeneratedImages,
    queryAgg,
    imageAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.book.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.book.count({ where: { deletedAt: null } }),
    prisma.query.count(),
    prisma.generatedImage.count(),
    prisma.query.aggregate({
      _sum: {
        promptTokens: true,
        completionTokens: true,
        embeddingTokens: true,
      },
    }),
    prisma.generatedImage.aggregate({
      _sum: {
        promptTokens: true,
        completionTokens: true,
        embeddingTokens: true,
        subjectTokens: true,
      },
    }),
  ]);

  const booksByStatus: BooksByStatusRow[] = booksGrouped
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => a.status.localeCompare(b.status));

  const qSum = nz(queryAgg._sum.promptTokens) + nz(queryAgg._sum.completionTokens) + nz(queryAgg._sum.embeddingTokens);
  const iSum =
    nz(imageAgg._sum.promptTokens) +
    nz(imageAgg._sum.completionTokens) +
    nz(imageAgg._sum.embeddingTokens) +
    nz(imageAgg._sum.subjectTokens);

  const tokenTotals: AdminPlatformStatsPayload["tokenTotals"] = {
    fromQueries: qSum,
    fromImages: iSum,
    grandTotal: qSum + iSum,
    breakdown: {
      query: {
        promptTokens: nz(queryAgg._sum.promptTokens),
        completionTokens: nz(queryAgg._sum.completionTokens),
        embeddingTokens: nz(queryAgg._sum.embeddingTokens),
      },
      generatedImage: {
        promptTokens: nz(imageAgg._sum.promptTokens),
        completionTokens: nz(imageAgg._sum.completionTokens),
        embeddingTokens: nz(imageAgg._sum.embeddingTokens),
        subjectTokens: nz(imageAgg._sum.subjectTokens),
      },
    },
  };

  return {
    totalUsers,
    booksByStatus,
    totalBooksActive,
    totalQueries,
    totalGeneratedImages,
    tokenTotals,
  };
}
