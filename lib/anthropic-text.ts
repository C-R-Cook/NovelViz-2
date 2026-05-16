import anthropic from "@/lib/anthropic";

const DEFAULT_ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-sonnet-4-20250514"] as const;

export function getAnthropicModelCandidates(): string[] {
  const raw = process.env.ANTHROPIC_MODEL;
  if (!raw) return [...DEFAULT_ANTHROPIC_MODELS];
  const parsed = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_ANTHROPIC_MODELS];
}

export async function getAnthropicTextResponse(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const candidates = getAnthropicModelCandidates();
  let lastErr: unknown = null;

  for (const model of candidates) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const first = message.content[0];
      const text = first && first.type === "text" ? first.text.trim() : "";
      if (text) {
        return {
          text,
          promptTokens: message.usage?.input_tokens ?? 0,
          completionTokens: message.usage?.output_tokens ?? 0,
        };
      }
      lastErr = new Error("Anthropic returned empty text content");
    } catch (err) {
      const maybeType = (err as { type?: string } | undefined)?.type;
      const maybeStatus = (err as { status?: number } | undefined)?.status;
      lastErr = err;
      if (maybeType === "not_found_error" || maybeStatus === 404) {
        continue;
      }
      throw err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  throw new Error("No Anthropic model candidates available");
}
