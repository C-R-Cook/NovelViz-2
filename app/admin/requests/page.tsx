import { getCurrentUser } from "@/lib/auth";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Book Requests | NovelViz Admin",
};

type GroupRow = {
  bookTitle: string;
  authorName: string;
  requestCount: number;
  firstRequested: Date;
};

export default async function AdminBookRequestsPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.role !== UserRole.admin) {
    redirect("/dashboard");
  }

  const requests = await prisma.bookRequest.findMany({
    orderBy: { createdAt: "asc" },
    select: { bookTitle: true, authorName: true, createdAt: true },
  });

  const byTitle = new Map<string, GroupRow>();
  for (const r of requests) {
    const title = r.bookTitle.trim();
    const existing = byTitle.get(title);
    if (!existing) {
      byTitle.set(title, {
        bookTitle: r.bookTitle,
        authorName: r.authorName,
        requestCount: 1,
        firstRequested: r.createdAt,
      });
    } else {
      existing.requestCount += 1;
      if (r.createdAt < existing.firstRequested) {
        existing.firstRequested = r.createdAt;
      }
    }
  }

  const rows = [...byTitle.values()].sort((a, b) => b.requestCount - a.requestCount);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-text-primary">Book requests</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Demand signals from readers (including guests), grouped by book title.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface/90">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Book title</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium">Request count</th>
              <th className="px-4 py-3 font-medium">First requested (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text-muted">
                  No book requests yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.bookTitle} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{row.bookTitle}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.authorName}</td>
                  <td className="px-4 py-3 tabular-nums text-text-primary">{row.requestCount}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatActivityAtUtc(row.firstRequested)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
