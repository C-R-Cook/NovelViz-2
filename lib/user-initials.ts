/** First + last initial when multiple words; otherwise first two letters of name or email. */
export function userInitials(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]!.charAt(0);
      const b = parts[parts.length - 1]!.charAt(0);
      return `${a}${b}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  return e.slice(0, 2).toUpperCase() || "?";
}
