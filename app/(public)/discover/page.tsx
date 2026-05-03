import { DiscoverCatalogueClient } from "./discover-catalogue-client";
import {
  getDiscoverBooksPage,
  getDiscoverFeaturedBooks,
} from "@/lib/discover-catalogue";

export const metadata = {
  title: "Discover | NovelViz",
};

export default async function DiscoverPage() {
  const [featured, firstPage] = await Promise.all([
    getDiscoverFeaturedBooks(),
    getDiscoverBooksPage({}),
  ]);

  return (
    <DiscoverCatalogueClient
      featured={featured}
      initialBooks={firstPage.books}
      initialNextCursor={firstPage.nextCursor}
    />
  );
}
