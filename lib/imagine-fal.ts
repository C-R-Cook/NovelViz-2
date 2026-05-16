import { UserRole } from "@db";
import {
  IMAGINE_FAL_DEFAULT_ADMIN_KEY,
  type ImagineFalModelKey,
} from "@/lib/imagine-fal-models";

export type { ImagineFalModelKey } from "@/lib/imagine-fal-models";
export { IMAGINE_FAL_DEFAULT_ADMIN_KEY } from "@/lib/imagine-fal-models";

const GROK_ENDPOINT = "xai/grok-imagine-image" as const;
const FLUX_SCHNELL_ENDPOINT = "fal-ai/flux/schnell" as const;
const SEEDREAM_V45_ENDPOINT = "fal-ai/bytedance/seedream/v4.5/text-to-image" as const;

const ADMIN_SPECS: Record<
  ImagineFalModelKey,
  { endpoint: string; modelLabel: string; buildInput: (prompt: string) => Record<string, unknown> }
> = {
  "flux-schnell": {
    endpoint: FLUX_SCHNELL_ENDPOINT,
    modelLabel: "flux/schnell",
    buildInput: (prompt) => ({
      prompt,
      image_size: "portrait_4_3",
      num_images: 1,
    }),
  },
  grok: {
    endpoint: GROK_ENDPOINT,
    modelLabel: "grok-imagine",
    buildInput: (prompt) => ({
      prompt,
      num_images: 1,
      aspect_ratio: "3:4",
      resolution: "1k",
      output_format: "jpeg",
    }),
  },
  "seedream-v45": {
    endpoint: SEEDREAM_V45_ENDPOINT,
    modelLabel: "seedream/v4.5",
    buildInput: (prompt) => ({
      prompt,
      image_size: "portrait_4_3",
      num_images: 1,
    }),
  },
};

const ADMIN_KEYS = new Set<string>(Object.keys(ADMIN_SPECS));

export function parseImagineFalModelKey(raw: unknown): ImagineFalModelKey | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim() as ImagineFalModelKey;
  return ADMIN_KEYS.has(k) ? k : null;
}

/**
 * Reader & partner: always Grok. Admin: chosen model (default cheapest = flux/schnell).
 */
export function resolveImagineFal(
  role: UserRole,
  bodyFalImagineModel: unknown,
  enrichedPrompt: string,
): { endpoint: string; input: Record<string, unknown>; modelStored: string } {
  if (role === UserRole.admin) {
    const key = parseImagineFalModelKey(bodyFalImagineModel) ?? IMAGINE_FAL_DEFAULT_ADMIN_KEY;
    const spec = ADMIN_SPECS[key];
    return {
      endpoint: spec.endpoint,
      input: spec.buildInput(enrichedPrompt),
      modelStored: spec.endpoint,
    };
  }
  const spec = ADMIN_SPECS.grok;
  return {
    endpoint: spec.endpoint,
    input: spec.buildInput(enrichedPrompt),
    modelStored: spec.endpoint,
  };
}
