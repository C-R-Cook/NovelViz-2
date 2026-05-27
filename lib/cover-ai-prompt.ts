export type CoverAiPromptParts = {
  basePromptPrefix: string;
  titlePromptTemplate: string;
  authorPromptTemplate: string;
  overlayTitle?: string | null;
  overlayAuthor?: string | null;
  publisherPrompt: string;
};

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

/**
 * Composition: admin prefix + optional title block + optional author block + publisher prompt.
 */
export function assembleCoverAiPrompt(parts: CoverAiPromptParts): string {
  const blocks: string[] = [];
  const prefix = parts.basePromptPrefix.trim();
  if (prefix.length > 0) blocks.push(prefix);

  const title = parts.overlayTitle?.trim() ?? "";
  if (title.length > 0) {
    const t = parts.titlePromptTemplate.trim();
    if (t.length > 0) {
      blocks.push(interpolateTemplate(t, { title }));
    }
  }

  const author = parts.overlayAuthor?.trim() ?? "";
  if (author.length > 0) {
    const a = parts.authorPromptTemplate.trim();
    if (a.length > 0) {
      blocks.push(interpolateTemplate(a, { author }));
    }
  }

  const pub = parts.publisherPrompt.trim();
  if (pub.length > 0) blocks.push(pub);

  return blocks.join("\n\n").trim();
}
