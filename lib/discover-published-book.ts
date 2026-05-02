import { prisma } from "@/lib/prisma";
import { cache } from "react";

/** One Prisma round-trip per request — shared by `generateMetadata` and the discover detail page. */
export const getPublishedDiscoverBookById = cache(async (id: string) => {
  return prisma.book.findFirst({
    where: { id, status: "published", deletedAt: null },
    include: {
      _count: { select: { chapters: true } },
    },
  });
});
