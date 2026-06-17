/**
 * Demo chart data for partner analytics (dashboard + book stats).
 *
 * Removal: set USE_PARTNER_ANALYTICS_MOCK to false, then delete this file and
 * remove the two `if (USE_PARTNER_ANALYTICS_MOCK)` blocks in:
 * - lib/partner-analytics.ts
 * - lib/partner-book-analytics.ts
 */

export const USE_PARTNER_ANALYTICS_MOCK = true;

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

function mockEngagementSeries(months: { monthKey: string; label: string }[], scale: number) {
  return months.map((m, i) => {
    const wave = 0.72 + Math.sin(i * 0.85) * 0.18 + Math.cos(i * 0.35) * 0.08;
    const questions = Math.max(0, Math.round((42 + i * 3.2) * wave * scale));
    const images = Math.max(0, Math.round((14 + i * 1.1) * wave * scale * 0.55));
    return { ...m, questions, images };
  });
}

function mockGallery(scale: number) {
  return {
    publicImages: Math.round(86 * scale),
    featuredImages: Math.round(12 * scale),
    totalLikes: Math.round(1240 * scale),
    commentCount: Math.round(318 * scale),
  };
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

  const engagementOverTime = mockEngagementSeries(months, 1);

  const topBooks: import("./partner-analytics").PartnerTopBookRow[] = [
    { bookId: "mock-1", title: "The Glass Orchard", readerCount: 112, engagement: 612 },
    { bookId: "mock-2", title: "Saltlight Harbor", readerCount: 86, engagement: 488 },
    { bookId: "mock-3", title: "Letters from the North", readerCount: 64, engagement: 351 },
    { bookId: "mock-4", title: "A Map of Quiet Rooms", readerCount: 41, engagement: 214 },
    { bookId: "mock-5", title: "Winter Index", readerCount: 29, engagement: 163 },
  ];

  return {
    distinctReaderCount,
    totalQueries,
    totalImages,
    avgEngagement,
    readersOverTime,
    engagementOverTime,
    gallery: mockGallery(1),
    topBooks,
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

  const scale = Math.max(0.35, book.chapterCount / 24);
  const engagementOverTime = mockEngagementSeries(months, scale);

  const n = Math.max(1, book.chapterCount);
  const chapterEngagement: import("./partner-book-analytics").ChapterEngagementRow[] = [];
  for (let c = 1; c <= n; c++) {
    const centre = (n + 1) / 2;
    const bell = Math.exp(-Math.pow(c - centre, 2) / (n * 1.8));
    const hook = c <= 3 ? 1.25 : c >= n - 2 ? 0.92 : 1;
    const base = 120 + bell * 180;
    const total = Math.max(12, Math.round(base * hook + (c % 5) * 7 + Math.sin(c) * 15));
    const questions = Math.max(4, Math.round(total * 0.72));
    const images = Math.max(2, total - questions);
    chapterEngagement.push({
      chapter: c,
      label: `Chapter ${c}`,
      questions,
      images,
      total: questions + images,
    });
  }

  const readerCount = readersOverTime[readersOverTime.length - 1]?.cumulativeReaders ?? peak;
  const libraryAddsWithoutProgress = Math.max(0, Math.round(readerCount * 0.14));
  const queryCount = Math.round(readerCount * 4.8 + 80);
  const imageCount = Math.round(readerCount * 1.4 + 24);
  const engagement = readerCount > 0 ? Math.round(((queryCount + imageCount) / readerCount) * 10) / 10 : 0;

  const readingDepth: import("./partner-book-analytics").ReadingDepthRow[] = [];
  let remaining = readerCount;
  for (let c = 1; c <= n; c++) {
    const drop = c === 1 ? 0 : Math.round(remaining * (0.04 + (c % 7) * 0.004));
    remaining = Math.max(0, remaining - drop);
    readingDepth.push({
      chapter: c,
      label: `Chapter ${c}`,
      readersReached: remaining,
    });
  }

  const recentQuestions: import("./partner-book-analytics").BookRecentQuestion[] = [
    {
      id: "mock-q-1",
      questionText: "Why does the narrator distrust the letter from the solicitor so early in the story?",
      chapterNumberAtTime: 2,
      createdAtMs: Date.now() - 1000 * 60 * 60 * 4,
      username: "mara_reads",
    },
    {
      id: "mock-q-2",
      questionText: "Is the storm on the coast meant to mirror the protagonist's guilt, or is that reading too far?",
      chapterNumberAtTime: 7,
      createdAtMs: Date.now() - 1000 * 60 * 60 * 28,
      username: "jonah.k",
    },
    {
      id: "mock-q-3",
      questionText: "Who actually owns the abandoned chapel mentioned in passing?",
      chapterNumberAtTime: 11,
      createdAtMs: Date.now() - 1000 * 60 * 60 * 52,
      username: "Reader",
    },
    {
      id: "mock-q-4",
      questionText: "What clues suggest the secondary character already knows the ending twist?",
      chapterNumberAtTime: 14,
      createdAtMs: Date.now() - 1000 * 60 * 60 * 80,
      username: "pagebound",
    },
  ];

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
    libraryAddsWithoutProgress,
    readersOverTime,
    engagementOverTime,
    chapterEngagement,
    readingDepth,
    gallery: mockGallery(scale),
    recentQuestions,
  };
}
