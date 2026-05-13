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
  { id: "flux-dev", label: "flux/dev", endpoint: "fal-ai/flux/dev", costPerImage: 0.025, description: "Better quality" },
  { id: "flux-2-dev", label: "flux-2/dev", endpoint: "fal-ai/flux-2", costPerImage: 0.012, description: "FLUX.2 open, cheap" },
  { id: "flux-2-pro", label: "flux-2/pro", endpoint: "fal-ai/flux-2-pro", costPerImage: 0.03, description: "FLUX.2 production" },
  { id: "flux-pro-11", label: "flux-pro/v1.1", endpoint: "fal-ai/flux-pro/v1.1", costPerImage: 0.04, description: "High quality" },
  {
    id: "flux-kontext-pro",
    label: "kontext/pro",
    endpoint: "fal-ai/flux-pro/kontext/text-to-image",
    costPerImage: 0.04,
    description: "Good consistency",
  },
  {
    id: "flux-kontext-max",
    label: "kontext/max",
    endpoint: "fal-ai/flux-pro/kontext/max/text-to-image",
    costPerImage: 0.08,
    description: "Max prompt adherence",
  },
  { id: "flux-pro-ultra", label: "flux-pro/ultra", endpoint: "fal-ai/flux-pro/v1.1-ultra", costPerImage: 0.06, description: "Best FLUX.1 quality" },
  { id: "nano-banana-2", label: "nano-banana-2", endpoint: "fal-ai/nano-banana-2", costPerImage: 0.08, description: "Gemini 3.1 Flash" },
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
