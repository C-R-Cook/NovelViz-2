export type BadgeDefinition = {
  key: string;
  name: string;
  description: string;
};

export const BADGES: Record<string, BadgeDefinition> = {
  OG_BETA: {
    key: "OG_BETA",
    name: "Original Reader",
    description: "Joined during the NovelViz beta",
  },
};

/**
 * Returns the badge definition for a given key, or null if unknown.
 * Unknown keys degrade gracefully — future badges awarded before this
 * file is updated will not break anything.
 */
export function getBadgeDefinition(key: string): BadgeDefinition | null {
  return BADGES[key] ?? null;
}
