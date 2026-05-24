import "./library-redesign.css";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color-mix(in_srgb,var(--border-subtle)_70%,var(--bg-hover))] ${className ?? ""}`}
    />
  );
}

export default function LibraryLoading() {
  return (
    <div className="library-root" aria-busy="true" aria-label="Loading library">
      <div className="library-root-inner">
        <SkeletonBar className="mb-8 h-9 w-48" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonBar key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            <SkeletonBar className="h-48 w-full" />
            <SkeletonBar className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
