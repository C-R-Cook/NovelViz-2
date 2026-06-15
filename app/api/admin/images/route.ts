import {
  parseAdminFeatureImagesFilter,
  parseAdminFeatureImagesTake,
  queryAdminFeatureImagesPage,
  ADMIN_FEATURE_IMAGES_PAGE_SIZE,
} from "@/lib/admin-feature-images";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

/** Paginated admin browse for featured / all / per-book images. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filter = parseAdminFeatureImagesFilter(url.searchParams.get("filter"));
  const bookId = url.searchParams.get("bookId")?.trim() || null;
  const skipRaw = url.searchParams.get("skip");
  const parsedSkip = skipRaw === null || skipRaw === "" ? 0 : Number.parseInt(skipRaw, 10);
  const skip = Number.isFinite(parsedSkip) && parsedSkip >= 0 ? parsedSkip : 0;
  const take = parseAdminFeatureImagesTake(url.searchParams.get("take"), ADMIN_FEATURE_IMAGES_PAGE_SIZE);

  if (filter === "book" && !bookId) {
    return NextResponse.json({ error: "bookId is required when filter=book" }, { status: 400 });
  }

  const { rows, hasMore } = await queryAdminFeatureImagesPage({
    filter,
    bookId,
    skip,
    take,
  });

  return NextResponse.json({
    images: rows,
    hasMore,
    pageSize: take,
    filter,
    bookId,
  });
}
