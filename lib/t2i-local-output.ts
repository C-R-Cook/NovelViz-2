import path from "node:path";

const T2I_REL_ROOT = "t2i-output";

export function getT2iOutputRoot(): string {
  return path.join(process.cwd(), T2I_REL_ROOT);
}

/** Safe for a single path segment (folder or file name). */
export function sanitizePathSegment(name: string, maxLen = 96): string {
  const s = name
    .replace(/[/\\?%*:|"<>.\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLen);
  return s.length > 0 ? s : "unknown";
}

/** Join segments under root; returns null if the result would escape `root`. */
export function safeJoinUnderRoot(root: string, ...segments: string[]): string | null {
  const joined = path.resolve(root, ...segments);
  const rel = path.relative(root, joined);
  if (rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) return null;
  return joined;
}
