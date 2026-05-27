import {
  FLUX_SCHNELL_ENDPOINT,
  GROK_IMAGINE_ENDPOINT,
  SEEDREAM_V45_ENDPOINT,
} from "@/lib/imagine-fal-models";
import type { CoverAiInputProfile } from "@/lib/cover-ai-settings";

/** Fal image payload shapes (varies by model). */
export function extractCoverAiFalImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const images = d.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
    const img = images[0] as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  const nested = d.data;
  if (nested && typeof nested === "object") {
    const nd = nested as Record<string, unknown>;
    const nestedImages = nd.images;
    if (Array.isArray(nestedImages) && nestedImages[0] && typeof nestedImages[0] === "object") {
      const img = nestedImages[0] as Record<string, unknown>;
      if (typeof img.url === "string") return img.url;
    }
  }
  const image = d.image;
  if (image && typeof image === "object") {
    const img = image as Record<string, unknown>;
    if (typeof img.url === "string") return img.url;
  }
  return null;
}

export function normalizeCoverAiEndpoint(raw: string): string {
  return raw.trim();
}

/** Build fal input for portrait book cover (~3:4). */
export function buildCoverAiFalInput(prompt: string, profile: CoverAiInputProfile): {
  endpoint: string;
  input: Record<string, unknown>;
} {
  switch (profile) {
    case "grok":
      return {
        endpoint: GROK_IMAGINE_ENDPOINT,
        input: {
          prompt,
          num_images: 1,
          aspect_ratio: "3:4",
          resolution: "1k",
          output_format: "jpeg",
        },
      };
    case "seedream_v45":
      return {
        endpoint: SEEDREAM_V45_ENDPOINT,
        input: {
          prompt,
          image_size: "portrait_4_3",
          num_images: 1,
        },
      };
    case "flux_schnell":
    default:
      return {
        endpoint: FLUX_SCHNELL_ENDPOINT,
        input: {
          prompt,
          image_size: "portrait_4_3",
          num_images: 1,
        },
      };
  }
}

export function buildCoverAiFalInputForCustomEndpoint(
  falEndpoint: string,
  prompt: string,
  profile: CoverAiInputProfile,
): { endpoint: string; input: Record<string, unknown> } {
  const normalized = normalizeCoverAiEndpoint(falEndpoint);
  const built = buildCoverAiFalInput(prompt, profile);
  if (normalized === built.endpoint) {
    return built;
  }
  const { input } = built;
  return { endpoint: normalized, input };
}
