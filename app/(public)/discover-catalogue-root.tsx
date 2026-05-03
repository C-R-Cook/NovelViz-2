import { DiscoverCatalogueClient } from "./discover/discover-catalogue-client";
import {
  getDiscoverBooksPage,
  getDiscoverFeaturedBooks,
} from "@/lib/discover-catalogue";

export async function DiscoverCatalogueRoot() {
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
