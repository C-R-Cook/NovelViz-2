/** POST body key for admins only — ignored for reader/partner. */
export type ImagineFalModelKey = "flux-schnell" | "grok" | "seedream-v45";

export const IMAGINE_FAL_DEFAULT_ADMIN_KEY: ImagineFalModelKey = "flux-schnell";

export const GROK_IMAGINE_ENDPOINT = "xai/grok-imagine-image" as const;
export const FLUX_SCHNELL_ENDPOINT = "fal-ai/flux/schnell" as const;
export const SEEDREAM_V45_ENDPOINT = "fal-ai/bytedance/seedream/v4.5/text-to-image" as const;

/** Chart keys for admin fal usage (Recharts `dataKey`). */
export type SiteImagineFalChartKey = "fluxSchnell" | "grok" | "seedream";

/** Imagine + admin picker models only — excludes T2I tester-only endpoints. */
export const SITE_IMAGINE_FAL_MODELS: ReadonlyArray<{
  key: ImagineFalModelKey;
  endpoint: string;
  label: string;
  chartKey: SiteImagineFalChartKey;
}> = [
  {
    key: "flux-schnell",
    endpoint: FLUX_SCHNELL_ENDPOINT,
    label: "flux/schnell",
    chartKey: "fluxSchnell",
  },
  {
    key: "grok",
    endpoint: GROK_IMAGINE_ENDPOINT,
    label: "Grok Imagine",
    chartKey: "grok",
  },
  {
    key: "seedream-v45",
    endpoint: SEEDREAM_V45_ENDPOINT,
    label: "Seedream v4.5",
    chartKey: "seedream",
  },
];

export const SITE_IMAGINE_FAL_ENDPOINT_SET = new Set(
  SITE_IMAGINE_FAL_MODELS.map((m) => m.endpoint),
);

export const SITE_IMAGINE_FAL_ENDPOINT_TO_CHART_KEY: Record<string, SiteImagineFalChartKey> =
  Object.fromEntries(SITE_IMAGINE_FAL_MODELS.map((m) => [m.endpoint, m.chartKey])) as Record<
    string,
    SiteImagineFalChartKey
  >;
