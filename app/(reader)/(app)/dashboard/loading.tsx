import "./dashboard-redesign.css";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color-mix(in_srgb,var(--border-subtle)_70%,var(--bg-hover))] ${className ?? ""}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="dashboard-root" aria-busy="true" aria-label="Loading dashboard">
      <div className="dashboard-root-inner">
        <div className="dashboard-body">
          <aside className="dashboard-sidebar" aria-hidden>
            <div className="dashboard-sidebar-user">
              <SkeletonBar className="mb-2 h-3 w-20" />
              <SkeletonBar className="h-5 w-32" />
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonBar key={i} className="mx-4 mb-2 h-9 w-[calc(100%-2rem)]" />
            ))}
          </aside>

          <main className="dashboard-main">
            <div className="dashboard-section-head">
              <SkeletonBar className="mb-2 h-3 w-40" />
              <SkeletonBar className="h-8 w-56 max-w-full" />
            </div>

            <div className="dashboard-kpi-grid dashboard-kpi-grid--3 mt-6">
              <SkeletonBar className="h-24 w-full" />
              <SkeletonBar className="h-24 w-full" />
              <SkeletonBar className="h-24 w-full" />
            </div>

            <SkeletonBar className="mt-8 h-4 w-36" />
            <SkeletonBar className="mt-4 h-28 w-full" />
            <SkeletonBar className="mt-3 h-28 w-full" />
            <SkeletonBar className="mt-3 h-28 w-full" />
          </main>
        </div>
      </div>
    </div>
  );
}
