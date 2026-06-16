import { GalleryClient } from "./gallery-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SpoilerProtection } from "@db";

export const metadata = {
  title: "Public Gallery | NovelViz",
};

export default async function GalleryPage() {
  const session = await getCurrentUser();

  if (!session) {
    return (
      <GalleryClient
        isLoggedIn={false}
        isAdmin={false}
        viewerUserId={null}
        globalSpoilerProtection={true}
        genrePreferences={[]}
        libraryBookIds={[]}
        spoilerSettingsByBookId={{}}
        viewerDisplayName={null}
      />
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      globalSpoilerProtection: true,
      genrePreferences: true,
    },
  });

  const userBookRows = await prisma.userBook.findMany({
    where: { userId: session.id, isActive: true },
    select: { bookId: true, spoilerProtection: true },
  });

  const spoilerSettingsByBookId = Object.fromEntries(
    userBookRows.map((r) => [r.bookId, r.spoilerProtection]),
  ) as Record<string, SpoilerProtection>;

  return (
    <GalleryClient
      isLoggedIn
      isAdmin={session.role === "admin"}
      viewerUserId={session.id}
      globalSpoilerProtection={dbUser?.globalSpoilerProtection ?? true}
      genrePreferences={dbUser?.genrePreferences ?? []}
      libraryBookIds={userBookRows.map((r) => r.bookId)}
      spoilerSettingsByBookId={spoilerSettingsByBookId}
      viewerDisplayName={session.username ?? session.name ?? null}
    />
  );
}
