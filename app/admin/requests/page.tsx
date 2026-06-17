import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import {
  queryBookRequestAggregates,
  queryBookRequestSubmissions,
} from "@/lib/admin-book-requests";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Book Requests | NovelViz Admin",
};

export default async function AdminBookRequestsPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.role !== UserRole.admin) {
    redirect(getRoleHomeUrl());
  }

  const [aggregates, submissions] = await Promise.all([
    queryBookRequestAggregates(),
    queryBookRequestSubmissions(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Book requests</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Reader demand signals from the Discover page, including guest submissions.
        </p>
      </div>

      <section aria-labelledby="book-requests-aggregate-heading" className="space-y-4">
        <div>
          <h2 id="book-requests-aggregate-heading" className="text-lg font-semibold text-text-primary">
            Demand by title
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Grouped by book title — useful for spotting popular requests.
          </p>
        </div>

        {aggregates.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">No book requests yet.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {aggregates.map((row) => (
                <li
                  key={row.bookTitle}
                  className="rounded-xl border border-border/80 bg-bg-base/80 p-4"
                >
                  <p className="font-medium text-text-primary">{row.bookTitle}</p>
                  <p className="text-sm text-text-secondary">{row.authorName}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-text-muted">Requests</dt>
                      <dd className="tabular-nums text-text-primary">{row.requestCount}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">First requested</dt>
                      <dd className="text-text-secondary">{formatActivityAtUtc(row.firstRequested)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-xl border border-border bg-bg-surface/90 md:block">
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
                  {aggregates.map((row) => (
                    <tr key={row.bookTitle} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{row.bookTitle}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.authorName}</td>
                      <td className="px-4 py-3 tabular-nums text-text-primary">{row.requestCount}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatActivityAtUtc(row.firstRequested)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="book-requests-submissions-heading" className="space-y-4">
        <div>
          <h2 id="book-requests-submissions-heading" className="text-lg font-semibold text-text-primary">
            All submissions
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Newest first{submissions.length > 0 ? ` (${submissions.length} shown)` : ""}.
          </p>
        </div>

        {submissions.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">No submissions yet.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {submissions.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-border/80 bg-bg-base/80 p-4"
                >
                  <p className="font-medium text-text-primary">{row.bookTitle}</p>
                  <p className="text-sm text-text-secondary">{row.authorName}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {formatActivityAtUtc(row.createdAt)} · {row.requesterLabel}
                  </p>
                  {row.message ? (
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{row.message}</p>
                  ) : (
                    <p className="mt-2 text-sm text-text-muted">No additional information.</p>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-xl border border-border bg-bg-surface/90 md:block">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3 font-medium">Submitted (UTC)</th>
                    <th className="px-4 py-3 font-medium">Book title</th>
                    <th className="px-4 py-3 font-medium">Author</th>
                    <th className="px-4 py-3 font-medium">Requested by</th>
                    <th className="px-4 py-3 font-medium">Additional information</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id} className="border-b border-border align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {formatActivityAtUtc(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">{row.bookTitle}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.authorName}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span>{row.requesterLabel}</span>
                        {row.requesterEmail && row.requesterLabel !== row.requesterEmail ? (
                          <span className="mt-0.5 block text-xs text-text-muted">{row.requesterEmail}</span>
                        ) : null}
                      </td>
                      <td className="max-w-md px-4 py-3 text-text-secondary">
                        {row.message ? (
                          <span className="whitespace-pre-wrap">{row.message}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
