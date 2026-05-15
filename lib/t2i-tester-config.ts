/** Model definitions for the admin T2I tester — keep in sync with delete-all API filter. */

export type T2ITesterModelDef = {
  id: string;
  label: string;
  endpoint: string;
  costPerImage: number;
  description: string;
};

/** Finalist models for the comparison matrix (columns: cheapest → most expensive, then id A–Z for ties). */
export const T2I_TESTER_MODELS: T2ITesterModelDef[] = [
  {
    id: "grok-imagine",
    label: "grok-imagine",
    endpoint: "xai/grok-imagine-image",
    costPerImage: 0.02,
    description: "xAI Aurora engine",
  },
  {
    id: "seedream-v4",
    label: "seedream/v4",
    endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
    costPerImage: 0.03,
    description: "ByteDance",
  },
  {
    id: "wan-2-7",
    label: "wan/2.7",
    endpoint: "fal-ai/wan/v2.7/text-to-image",
    costPerImage: 0.03,
    description: "Alibaba, reasoning pre-pass",
  },
  {
    id: "seedream-v45",
    label: "seedream/v4.5",
    endpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    costPerImage: 0.04,
    description: "ByteDance latest",
  },
  { id: "flux-pro-ultra", label: "flux-pro/ultra", endpoint: "fal-ai/flux-pro/v1.1-ultra", costPerImage: 0.06, description: "Best FLUX.1 quality" },
  {
    id: "wan-2-7-pro",
    label: "wan/2.7-pro",
    endpoint: "fal-ai/wan/v2.7/pro/text-to-image",
    costPerImage: 0.075,
    description: "Alibaba WAN 2.7 Pro",
  },
];

export const T2I_TESTER_MODEL_LABELS = T2I_TESTER_MODELS.map((m) => m.label);

/** One image per (model, prompt) in the matrix UI. */
export const T2I_TESTER_RUNS_PER_PROMPT = 1;

export const T2I_TESTER_DEFAULT_IMAGE_SIZE = "portrait_4_3";

export const T2I_TESTER_IMAGE_SIZE_OPTIONS = [
  "portrait_4_3",
  "square_hd",
  "landscape_16_9",
  "portrait_16_9",
] as const;
