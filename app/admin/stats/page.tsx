// TODO: deprecated — functionality moved to /dashboard tabs
import Link from "next/link";

export const metadata = {
  title: "Statistics | NovelViz Admin",
};

export default function AdminStatsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold text-text-primary">Statistics</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        Detailed usage and catalogue statistics will live here. For now, use the dashboard quick stats and the book
        list for operational insight.
      </p>
      <Link
        href="/dashboard?tab=admin-stats"
        className="mt-8 inline-flex text-sm font-medium text-accent-text underline-offset-2 hover:underline"
      >
        ← Open dashboard (Admin Stats)
      </Link>
    </div>
  );
}
