import { prisma } from "@/lib/prisma";
import type { Prisma } from "@db";

/** Sync denormalized likeCount after likes are added or removed. */
export async function recalculateImageLikeCounts(
  imageIds: string[],
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const uniqueIds = [...new Set(imageIds)];
  if (uniqueIds.length === 0) return;

  for (const imageId of uniqueIds) {
    const count = await tx.like.count({ where: { imageId } });
    await tx.generatedImage.update({
      where: { id: imageId },
      data: { likeCount: count },
    });
  }
}
