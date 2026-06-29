export type ContentTestSupplier = "anthropic" | "openai" | "fal";

const SUPPLIER_API_KEYS: Record<ContentTestSupplier, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  fal: "FAL_API_KEY",
};

export const CONTENT_TEST_QA_ANSWER =
  "[content-test] Placeholder reading-companion answer.";
export const CONTENT_TEST_SUBJECT = "[content-test] placeholder subject";
export const CONTENT_TEST_ENRICHED_PROMPT =
  "[content-test] placeholder enriched image prompt";
/** References existing public/content-test-placeholder.png — do not create or overwrite. */
export const CONTENT_TEST_PLACEHOLDER_IMAGE_URL = "/content-test-placeholder.png";

export const EMBEDDING_DIMENSION = 1536;

export function isContentTestMode(): boolean {
  return process.env.CONTENT_TEST === "true";
}

function isApiKeyMissing(envVar: string): boolean {
  const value = process.env[envVar];
  return !value || value.trim() === "";
}

export type SupplierBlockReason = "CONTENT_TEST enabled" | `${string}_API_KEY missing`;

export function getSupplierBlockReason(
  supplier: ContentTestSupplier,
): SupplierBlockReason | null {
  if (isContentTestMode()) {
    return "CONTENT_TEST enabled";
  }
  const envVar = SUPPLIER_API_KEYS[supplier];
  if (isApiKeyMissing(envVar)) {
    return `${envVar} missing` as SupplierBlockReason;
  }
  return null;
}

export function isSupplierBlocked(supplier: ContentTestSupplier): boolean {
  return getSupplierBlockReason(supplier) !== null;
}

export function logSupplierSkipped(
  supplier: ContentTestSupplier,
  reason: SupplierBlockReason,
): void {
  console.log(`[content-test] skipped ${supplier} call (${reason})`);
}

export function zeroEmbeddings(count: number): number[][] {
  return Array.from({ length: count }, () => Array(EMBEDDING_DIMENSION).fill(0));
}

export function zeroEmbeddingTokens(): 0 {
  return 0;
}
