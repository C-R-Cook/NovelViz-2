import { getCurrentUser } from "@/lib/auth";
import {
  buildGalleryPageResponse,
  emptyGuestGalleryContext,
  loadGalleryViewerContext,
} from "@/lib/gallery-page-data";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/gallery
 * Query: ?session=true — session browsing override for library rows (mirrors per-book gallery API).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionOverride = url.searchParams.get("session") === "true";

  const session = await getCurrentUser();

  if (!session) {
    const data = await buildGalleryPageResponse({
      ctx: emptyGuestGalleryContext(),
      sessionOverride: false,
    });
    return NextResponse.json(data);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      role: true,
      globalSpoilerProtection: true,
      genrePreferences: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ctx = await loadGalleryViewerContext({
    id: dbUser.id,
    role: dbUser.role,
    globalSpoilerProtection: dbUser.globalSpoilerProtection,
    genrePreferences: dbUser.genrePreferences,
  });

  const data = await buildGalleryPageResponse({
    ctx,
    sessionOverride: sessionOverride && dbUser.role !== "admin",
  });

  return NextResponse.json(data);
}
