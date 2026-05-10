import type { BookGenre } from "@db";

/** Deep shelf tone + brighter accent for glows / UI (aligned with tmp/discover-page.jsx). */
export function discoverGenrePalette(genre: BookGenre | null): { glow: string; accent: string } {
  switch (genre) {
    case "horror":
    case "gothic":
      return { glow: "#8B1A1A", accent: "#C41E3A" };
    case "romance":
      return { glow: "#2E1A1A", accent: "#C47A1E" };
    case "literary_fiction":
    case "mystery":
      return { glow: "#1A1A2E", accent: "#6A0DAD" };
    case "adventure":
    case "science_fiction":
      return { glow: "#0A1A2E", accent: "#1565C0" };
    case "fantasy":
      return { glow: "#1A1528", accent: "#7E57C2" };
    case "historical_fiction":
      return { glow: "#2E2414", accent: "#A67C52" };
    case "thriller":
      return { glow: "#1A1A1A", accent: "#B71C1C" };
    case "childrens_fiction":
      return { glow: "#1A2E1A", accent: "#2E7D32" };
    case "classic_literature":
      return { glow: "#1E1A14", accent: "#B8860B" };
    case "crime":
      return { glow: "#151820", accent: "#455A64" };
    case "biography":
      return { glow: "#1E1E12", accent: "#827717" };
    case "short_stories":
      return { glow: "#1A1A24", accent: "#5C6BC0" };
    default:
      return { glow: "#1A1814", accent: "#B8860B" };
  }
}
