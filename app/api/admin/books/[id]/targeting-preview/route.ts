import { requireAdminApi } from "@/lib/admin-auth";
import { getBookTargetingPreview, roundPreviewCounts } from "@/lib/book-targeting-preview";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const preview = await getBookTargetingPreview(id);
  if (!preview) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const rounded = roundPreviewCounts(preview);
  return NextResponse.json({
    genrePreferenceReaders: rounded.genrePreferenceReaders,
    libraryGenreReaders: rounded.libraryGenreReaders,
    ageLabel: preview.ageLabel,
    genderLabel: preview.genderLabel,
    countryLabel: preview.countryLabel,
    combinedReach: rounded.combinedReach,
  });
}
