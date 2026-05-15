import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookStatus, UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Ensures this route is not statically skipped in dev/build edge cases. */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const books = await prisma.book.findMany({
    where: { status: BookStatus.published, deletedAt: null },
    select: {
      id: true,
      title: true,
      author: true,
      _count: { select: { chapters: true } },
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({
    books: books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      chapterCount: b._count.chapters,
    })),
  });
}
