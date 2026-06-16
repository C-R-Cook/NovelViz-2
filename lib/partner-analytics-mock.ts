/**
 * Demo chart data for partner analytics (dashboard + book stats).
 *
 * Removal: set USE_PARTNER_ANALYTICS_MOCK to false, then delete this file and
 * remove the two `if (USE_PARTNER_ANALYTICS_MOCK)` blocks in:
 * - lib/partner-analytics.ts
 * - lib/partner-book-analytics.ts
 */

export const USE_PARTNER_ANALYTICS_MOCK = false;

function lastNMonthKeys(n: number): { monthKey: string; label: string }[] {
  const out: { monthKey: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    out.push({ monthKey, label });
  }
  return out;
}

export function mockPartnerAnalyticsPayload(): import("./partner-analytics").PartnerAnalyticsPayload {
  const months = lastNMonthKeys(12);
  const peak = 248;
  const readersOverTime = months.map((m, i) => {
    const t = i / (months.length - 1 || 1);
    const eased = 1 - Math.pow(1 - t, 1.35);
    const noise = Math.sin(i * 0.9) * 6 + Math.cos(i * 0.4) * 4;
    const cumulativeReaders = Math.max(0, Math.round(eased * peak + noise));
    return { ...m, cumulativeReaders };
  });

  const ageBuckets: import("./partner-analytics").PartnerBarRow[] = [
    { label: "Under 18", count: 28 },
    { label: "18–24", count: 96 },
    { label: "25–34", count: 142 },
    { label: "35–44", count: 74 },
    { label: "45–54", count: 41 },
    { label: "55+", count: 18 },
    { label: "Prefer not to say", count: 12 },
    { label: "Not specified", count: 34 },
  ];

  const genreBuckets: import("./partner-analytics").PartnerBarRow[] = [
    { label: "Fantasy", count: 118 },
    { label: "Romance", count: 86 },
    { label: "Sci-Fi", count: 62 },
    { label: "Literary Fiction", count: 44 },
    { label: "Mystery / Thriller", count: 38 },
    { label: "Young Adult", count: 31 },
    { label: "Historical Fiction", count: 22 },
    { label: "Other / unspecified", count: 52 },
  ];

  const distinctReaderCount = readersOverTime[readersOverTime.length - 1]?.cumulativeReaders ?? peak;
  const totalQueries = 1842;
  const totalImages = 396;
  const avgEngagement =
    distinctReaderCount > 0 ? Math.round(((totalQueries + totalImages) / distinctReaderCount) * 10) / 10 : 0;

  return {
    distinctReaderCount,
    totalQueries,
    totalImages,
    avgEngagement,
    readersOverTime,
    ageBuckets,
    genreBuckets,
  };
}

export function mockPartnerBookPayload(book: {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  chapterCount: number;
}): import("./partner-book-analytics").PartnerBookAnalyticsPayload {
  const months = lastNMonthKeys(12);
  const peak = Math.max(42, Math.round(38 + book.chapterCount * 2.2));
  const readersOverTime = months.map((m, i) => {
    const t = i / (months.length - 1 || 1);
    const eased = 1 - Math.pow(1 - t, 1.45);
    const noise = Math.sin(i * 1.1) * 4;
    const cumulativeReaders = Math.max(0, Math.round(eased * peak + noise));
    return { ...m, cumulativeReaders };
  });

  const n = Math.max(1, book.chapterCount);
  const chapterEngagement: import("./partner-book-analytics").ChapterEngagementRow[] = [];
  for (let c = 1; c <= n; c++) {
    const centre = (n + 1) / 2;
    const bell = Math.exp(-Math.pow(c - centre, 2) / (n * 1.8));
    const hook = c <= 3 ? 1.25 : c >= n - 2 ? 0.92 : 1;
    const base = 120 + bell * 180;
    const total = Math.max(12, Math.round(base * hook + (c % 5) * 7 + Math.sin(c) * 15));
    chapterEngagement.push({
      chapter: c,
      label: `Chapter ${c}`,
      total,
    });
  }

  const readerCount = readersOverTime[readersOverTime.length - 1]?.cumulativeReaders ?? peak;
  const queryCount = Math.round(readerCount * 4.8 + 80);
  const imageCount = Math.round(readerCount * 1.4 + 24);
  const engagement = readerCount > 0 ? Math.round(((queryCount + imageCount) / readerCount) * 10) / 10 : 0;

  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      coverImageUrl: book.coverImageUrl,
      chapterCount: book.chapterCount,
    },
    readerCount,
    queryCount,
    imageCount,
    engagement,
    readersOverTime,
    chapterEngagement,
  };
}
