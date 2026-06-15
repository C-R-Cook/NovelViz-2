import { LandingClient } from "./landing-client";
import { getCurrentUser } from "@/lib/auth";
import {
  FEATURED_IMAGE_LANDING_LIMIT,
  getFeaturedImagesForDisplay,
  type FeaturedImageCard,
} from "@/lib/featured-image-selection";
import "./landing-redesign.css";

export const metadata = {
  title: "NovelViz — Every Chapter, Alive",
  description:
    "An AI reading companion that knows only what you've read. Ask questions, generate images — completely spoiler-free.",
};

export default async function HomePage() {
  const user = await getCurrentUser();
  const featuredImages: FeaturedImageCard[] = await getFeaturedImagesForDisplay(user?.id ?? null, {
    limit: FEATURED_IMAGE_LANDING_LIMIT,
  });
  return <LandingClient isLoggedIn={!!user} featuredImages={featuredImages} />;
}
