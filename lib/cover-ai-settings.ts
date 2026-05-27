import { prisma } from "@/lib/prisma";

export const COVER_AI_SETTINGS_ID = "default" as const;

export type CoverAiInputProfile = "flux_schnell" | "grok" | "seedream_v45";

export type CoverAiModelEntry = {
  key: string;
  label: string;
  falEndpoint: string;
  inputProfile: CoverAiInputProfile;
};

const PROFILE_SET = new Set<CoverAiInputProfile>(["flux_schnell", "grok", "seedream_v45"]);

export function defaultCoverAiModelsJson(): CoverAiModelEntry[] {
  return [
    {
      key: "flux-schnell",
      label: "FLUX Schnell",
      falEndpoint: "fal-ai/flux/schnell",
      inputProfile: "flux_schnell",
    },
    {
      key: "grok",
      label: "Grok Imagine",
      falEndpoint: "xai/grok-imagine-image",
      inputProfile: "grok",
    },
    {
      key: "seedream-v45",
      label: "Seedream v4.5",
      falEndpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      inputProfile: "seedream_v45",
    },
  ];
}

export function defaultCoverAiPromptPrefixes(): Pick<
  { basePromptPrefix: string; titlePromptTemplate: string; authorPromptTemplate: string },
  "basePromptPrefix" | "titlePromptTemplate" | "authorPromptTemplate"
> {
  return {
    basePromptPrefix:
      "Professional ebook cover illustration, portrait 3:4 aspect ratio, centered composition suitable for bookstore thumbnail, cohesive color palette, high detail, crisp edges, legible typography if text appears.",
    titlePromptTemplate:
      'Integrate readable book title text: "{{title}}". Typography should be polished, hierarchical, well-spaced from edges, contrasting with background, scaled for cover hierarchy.',
    authorPromptTemplate:
      'Place author attribution: "{{author}}". Secondary to title, complementary font styling, unobtrusive positioning (typically bottom or below title block), excellent readability.',
  };
}

/** Parse models array from Json; callers validate defaults exist. */
export function parseCoverAiModelsJson(raw: unknown): CoverAiModelEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error("modelsJson must be an array");
  }
  const out: CoverAiModelEntry[] = [];
  const seenKeys = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") throw new Error("Invalid model row");
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const falEndpoint = typeof r.falEndpoint === "string" ? r.falEndpoint.trim() : "";
    const ip = r.inputProfile;
    if (
      typeof ip !== "string" ||
      !PROFILE_SET.has(ip as CoverAiInputProfile)
    ) {
      throw new Error(`Invalid inputProfile on model "${key}"`);
    }
    if (!key.length || key.length > 64) throw new Error("Model key invalid");
    if (!label.length || label.length > 120) throw new Error("Model label invalid");
    if (!falEndpoint.length || falEndpoint.length > 200) throw new Error("Invalid falEndpoint");
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate model key: ${key}`);
    }
    seenKeys.add(key);
    out.push({
      key,
      label,
      falEndpoint,
      inputProfile: ip as CoverAiInputProfile,
    });
  }
  if (out.length === 0) {
    throw new Error("At least one model is required");
  }
  return out;
}

/** Load singleton settings; upsert defaults if missing. */
export async function getCoverAiAdminSettings(): Promise<{
  id: string;
  basePromptPrefix: string;
  titlePromptTemplate: string;
  authorPromptTemplate: string;
  modelsJson: CoverAiModelEntry[];
}> {
  let row = await prisma.coverAiAdminSettings.findUnique({ where: { id: COVER_AI_SETTINGS_ID } });
  const defaultsPrompts = defaultCoverAiPromptPrefixes();
  const defaultsModels = defaultCoverAiModelsJson();
  if (!row) {
    row = await prisma.coverAiAdminSettings.create({
      data: {
        id: COVER_AI_SETTINGS_ID,
        ...defaultsPrompts,
        modelsJson: defaultsModels,
      },
    });
  }
  const modelsJson = parseCoverAiModelsJson(row.modelsJson);
  return {
    id: row.id,
    basePromptPrefix: row.basePromptPrefix,
    titlePromptTemplate: row.titlePromptTemplate,
    authorPromptTemplate: row.authorPromptTemplate,
    modelsJson,
  };
}

export function findCoverAiModelEntry(
  models: CoverAiModelEntry[],
  modelKey: string,
): CoverAiModelEntry | null {
  const k = modelKey.trim();
  return models.find((m) => m.key === k) ?? null;
}
