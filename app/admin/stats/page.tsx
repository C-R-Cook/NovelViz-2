import Link from "next/link";

export const metadata = {
  title: "Statistics | NovelViz Admin",
};

export default function AdminStatsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Statistics</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Detailed usage and catalogue statistics will live here. For now, use the dashboard quick stats and the book
        list for operational insight.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300/90"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
