const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Fixed ASCII layout (no `Intl`) so server and client never disagree during hydration. */
export function formatActivityAtUtc(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);

  const month = MONTHS[d.getUTCMonth()]!;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  let hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const isAm = hour < 12;
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const mm = String(minute).padStart(2, "0");
  return `${month} ${day}, ${year}, ${hour}:${mm} ${isAm ? "AM" : "PM"}`;
}
