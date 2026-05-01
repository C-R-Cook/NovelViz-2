import type { ListingPreferenceAfterReview } from "@db";

export function labelListingPreferenceAfterReview(
  v: ListingPreferenceAfterReview | null | undefined,
): string {
  if (v === "unlisted") return "Unlisted (not shown in catalogue)";
  return "Listed in public catalogue";
}
