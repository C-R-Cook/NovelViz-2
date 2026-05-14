/** Model definitions for the admin T2I tester — keep in sync with delete-all API filter. */

export type T2ITesterModelDef = {
  id: string;
  label: string;
  endpoint: string;
  costPerImage: number;
  description: string;
};

export const T2I_TESTER_MODELS: T2ITesterModelDef[] = [
  { id: "flux-schnell", label: "flux/schnell", endpoint: "fal-ai/flux/schnell", costPerImage: 0.003, description: "Baseline — dev/test only" },
  { id: "flux-pro-11", label: "flux-pro/v1.1", endpoint: "fal-ai/flux-pro/v1.1", costPerImage: 0.04, description: "High quality" },
  {
    id: "flux-kontext-pro",
    label: "kontext/pro",
    endpoint: "fal-ai/flux-pro/kontext/text-to-image",
    costPerImage: 0.04,
    description: "Good consistency",
  },
  { id: "flux-pro-ultra", label: "flux-pro/ultra", endpoint: "fal-ai/flux-pro/v1.1-ultra", costPerImage: 0.06, description: "Best FLUX.1 quality" },
  {
    id: "seedream-v4",
    label: "seedream/v4",
    endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
    costPerImage: 0.03,
    description: "ByteDance",
  },
  {
    id: "seedream-v45",
    label: "seedream/v4.5",
    endpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    costPerImage: 0.04,
    description: "ByteDance latest",
  },
  {
    id: "wan-2-7",
    label: "wan/2.7",
    endpoint: "fal-ai/wan/v2.7/text-to-image",
    costPerImage: 0.03,
    description: "Alibaba, reasoning pre-pass",
  },
  {
    id: "kling-image-v3",
    label: "kling-image/v3",
    endpoint: "fal-ai/kling-image/v3/text-to-image",
    costPerImage: 0.028,
    description: "Latest Kling image model",
  },
  {
    id: "qwen-2512",
    label: "qwen-image/2512",
    endpoint: "fal-ai/qwen-image-2512",
    costPerImage: 0.02,
    description: "Improved face rendering",
  },
  {
    id: "gpt-image-15",
    label: "gpt-image-1.5",
    endpoint: "fal-ai/gpt-image-1.5",
    costPerImage: 0.034,
    description: "OpenAI medium quality",
  },
  {
    id: "grok-imagine",
    label: "grok-imagine",
    endpoint: "fal-ai/grok-imagine",
    costPerImage: 0.02,
    description: "xAI Aurora engine",
  },
];

export const T2I_TESTER_MODEL_LABELS = T2I_TESTER_MODELS.map((m) => m.label);

export const T2I_TESTER_RUNS_PER_PROMPT = 5;

export const T2I_TESTER_DEFAULT_IMAGE_SIZE = "portrait_4_3";

export const T2I_TESTER_IMAGE_SIZE_OPTIONS = [
  "portrait_4_3",
  "square_hd",
  "landscape_16_9",
  "portrait_16_9",
] as const;
