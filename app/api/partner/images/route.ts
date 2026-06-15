import { getCurrentUser } from "@/lib/auth";
import {
  parsePartnerFeatureImagesTake,
  PARTNER_FEATURE_IMAGES_PAGE_SIZE,
  queryPartnerFeatureImagesPage,
} from "@/lib/partner-feature-images";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

/** Paginated partner browse for public images on owned books. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.partner && user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const skipRaw = url.searchParams.get("skip");
  const parsedSkip = skipRaw === null || skipRaw === "" ? 0 : Number.parseInt(skipRaw, 10);
  const skip = Number.isFinite(parsedSkip) && parsedSkip >= 0 ? parsedSkip : 0;
  const take = parsePartnerFeatureImagesTake(
    url.searchParams.get("take"),
    PARTNER_FEATURE_IMAGES_PAGE_SIZE,
  );

  const { rows, hasMore } = await queryPartnerFeatureImagesPage({
    ownerId: user.id,
    skip,
    take,
  });

  return NextResponse.json({
    images: rows,
    hasMore,
    pageSize: take,
  });
}
